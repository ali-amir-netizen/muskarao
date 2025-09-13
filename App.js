import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  SafeAreaView,
  Text,
  View,
  Button,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,          // ✅ add this
  Linking         // ✅ add this (needed for CommunityScreen)
} from "react-native";



import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
let sessionHistory = []; // Store summary of sessions
let currentUser = { type: null, email: '', username: '' };
let currentMember = { email: '', role: '', isAdmin: false, isOnline: false };

const ADMIN_EMAIL = '24hourstired@gmail.com';

/* -------------------------
   AsyncStorage helpers
   ------------------------- */

const getSessionCount = async (type, email = '') => {
  if (type === 'guest') {
    const count = await AsyncStorage.getItem('guestSessionCount');
    return parseInt(count || '0');
  } else {
    const counts = await AsyncStorage.getItem('emailSessionCounts');
    const parsed = JSON.parse(counts || '{}');
    return parsed[email] || 0;
  }
};

const incrementSessionCount = async (type, email = '') => {
  if (type === 'guest') {
    const count = await getSessionCount('guest');
    await AsyncStorage.setItem('guestSessionCount', (count + 1).toString());
  } else {
    const counts = await AsyncStorage.getItem('emailSessionCounts');
    const parsed = JSON.parse(counts || '{}');
    parsed[email] = (parsed[email] || 0) + 1;
    await AsyncStorage.setItem('emailSessionCounts', JSON.stringify(parsed));
  }import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  SafeAreaView,
  Text,
  View,
  Button,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Linking,
  Image
} from "react-native";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import * as Device from 'expo-device'; // For device ID
import { v4 as uuidv4 } from 'uuid'; // For fallback UUID

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

let sessionHistory = []; // Store summary of sessions (local)
let currentUser = { type: null, email: '', username: '', deviceId: '' };
let currentMember = { email: '', role: '', isAdmin: false, isOnline: false };
const ADMIN_EMAIL = '24hourstired@gmail.com';

/* -------------------------
   AsyncStorage helpers
   ------------------------- */
const getSessionCount = async (deviceIdOrEmail) => {
  const counts = await AsyncStorage.getItem('sessionCounts');
  const parsed = JSON.parse(counts || '{}');
  return parsed[deviceIdOrEmail] || 0;
};

const incrementSessionCount = async (deviceIdOrEmail) => {
  const counts = await AsyncStorage.getItem('sessionCounts');
  const parsed = JSON.parse(counts || '{}');
  parsed[deviceIdOrEmail] = (parsed[deviceIdOrEmail] || 0) + 1;
  await AsyncStorage.setItem('sessionCounts', JSON.stringify(parsed));
};

/* -------------------------
   Firestore helpers
   ------------------------- */
const isSubscribed = async (deviceIdOrEmail) => {
  const doc = await firestore().collection('subscriptions').doc(deviceIdOrEmail).get();
  if (doc.exists) {
    const { subscribed, expiry } = doc.data();
    if (subscribed && expiry && expiry.toDate() > new Date()) {
      return true;
    }
    if (expiry && expiry.toDate() <= new Date()) {
      await firestore().collection('subscriptions').doc(deviceIdOrEmail).delete();
    }
  }
  return false;
};

const setSubscribed = async (deviceIdOrEmail) => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7); // 1 week
  await firestore().collection('subscriptions').doc(deviceIdOrEmail).set({
    subscribed: true,
    expiry: firestore.Timestamp.fromDate(expiry)
  });
};

const getUsedEmails = async () => {
  const counts = await AsyncStorage.getItem('sessionCounts');
  const parsed = JSON.parse(counts || '{}');
  return Object.keys(parsed).filter(key => key.includes('@'));
};

const getJoiningRequests = async () => {
  const snapshot = await firestore().collection('joiningRequests').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const addJoiningRequest = async (email, username) => {
  await firestore().collection('joiningRequests').add({
    email,
    username,
    createdAt: firestore.FieldValue.serverTimestamp()
  });
};

const approveJoiningRequest = async (email, role) => {
  await firestore().collection('joiningRequests').where('email', '==', email).get()
    .then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete()));
  await firestore().collection('members').doc(email).set({
    email,
    role,
    isOnline: false,
    rating: 0,
    ratingCount: 0
  });
};

const rejectJoiningRequest = async (email) => {
  await firestore().collection('joiningRequests').where('email', '==', email).get()
    .then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete()));
};

const getMembers = async () => {
  const snapshot = await firestore().collection('members').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getBadUsers = async () => {
  const snapshot = await firestore().collection('badUsers').get();
  return snapshot.docs.map(doc => doc.id);
};

const addBadUser = async (deviceIdOrEmail) => {
  await firestore().collection('badUsers').doc(deviceIdOrEmail).set({
    reportedAt: firestore.FieldValue.serverTimestamp()
  });
};

const blockBadUser = async (deviceIdOrEmail) => {
  await firestore().collection('badUsers').doc(deviceIdOrEmail).delete();
};

const getBadMembers = async () => {
  const snapshot = await firestore().collection('badMembers').get();
  return snapshot.docs.map(doc => doc.id);
};

const addBadMember = async (email) => {
  await firestore().collection('badMembers').doc(email).set({
    reportedAt: firestore.FieldValue.serverTimestamp()
  });
};

const blockBadMember = async (email) => {
  await firestore().collection('badMembers').doc(email).delete();
};

const getChatRequests = async (memberEmail) => {
  const snapshot = await firestore().collection('chatRequests').where('memberEmail', '==', memberEmail).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const addChatRequest = async (memberEmail, userId, topic) => {
  await firestore().collection('chatRequests').add({
    memberEmail,
    userId,
    topic,
    status: 'pending',
    createdAt: firestore.FieldValue.serverTimestamp()
  });
};

const getActiveChats = async (deviceIdOrEmail) => {
  const snapshot = await firestore().collection('activeChats').where('userId', '==', deviceIdOrEmail).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const addActiveChat = async (deviceIdOrEmail, chatId, otherId, topic) => {
  await firestore().collection('activeChats').doc(chatId).set({
    userId: deviceIdOrEmail,
    otherId,
    topic,
    startTime: firestore.FieldValue.serverTimestamp()
  });
};

const removeActiveChat = async (chatId) => {
  await firestore().collection('activeChats').doc(chatId).delete();
};

const getChatHistory = async (chatId) => {
  const local = await AsyncStorage.getItem(`chat_${chatId}`);
  if (local) return JSON.parse(local);
  const snapshot = await firestore().collection('chats').doc(chatId).collection('messages').orderBy('timestamp', 'asc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const saveChatHistory = async (chatId, messages) => {
  await AsyncStorage.setItem(`chat_${chatId}`, JSON.stringify(messages));
};

const getOnlineUsers = async () => {
  const snapshot = await firestore().collection('onlineUsers').where('isOnline', '==', true).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const setUserOnline = async (deviceIdOrEmail, username, isOnline) => {
  const userRef = firestore().collection('onlineUsers').doc(deviceIdOrEmail);
  await userRef.set({
    username,
    isOnline,
    lastSeen: firestore.FieldValue.serverTimestamp(),
    rating: 0,
    ratingCount: 0
  }, { merge: true });
  if (isOnline) {
    userRef.onDisconnect().update({ isOnline: false });
  }
};

const submitRating = async (targetId, rating) => {
  const doc = await firestore().collection(currentUser.type === 'email' ? 'members' : 'onlineUsers').doc(targetId).get();
  if (doc.exists) {
    const { rating: currentRating, ratingCount } = doc.data();
    const newCount = ratingCount + 1;
    const newRating = ((currentRating * ratingCount) + rating) / newCount;
    await firestore().collection(currentUser.type === 'email' ? 'members' : 'onlineUsers').doc(targetId).update({
      rating: newRating,
      ratingCount: newCount
    });
  }
};

/* -------------------------
   Logout helper
   ------------------------- */
const logout = async (navigation) => {
  try {
    if (currentMember.email) {
      await firestore().collection('members').doc(currentMember.email).update({ isOnline: false });
    }
    if (currentUser.type) {
      const userId = currentUser.type === 'email' ? currentUser.email : currentUser.deviceId;
      await setUserOnline(userId, currentUser.username, false);
      await auth().signOut();
    }
    currentUser = { type: null, email: '', username: '', deviceId: '' };
    currentMember = { email: '', role: '', isAdmin: false, isOnline: false };
    navigation.navigate('Home');
  } catch (error) {
    Alert.alert('Error', 'Failed to log out');
  }
};

/* -------------------------
   Screens
   ------------------------- */
function HomeScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    const getDeviceId = async () => {
      let id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = Device.deviceName ? `${Device.deviceName}_${uuidv4()}` : uuidv4();
        await AsyncStorage.setItem('deviceId', id);
      }
      setDeviceId(id);
    };
    getDeviceId();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>🐨 Welcome to Muskarao! 🐸</Text>
      <Text style={styles.welcomeText}>Koala & Kermit are here to cheer you up! 😊🎉</Text>
      <Text style={styles.welcomeSubText}>Wave hello 👋 and let's get started!</Text>
      <View style={styles.giftBoxContainer}>
        <TextInput
          placeholder="Enter Username 👤"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />
        <TextInput
          placeholder="Login with Email 📧"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Password 🔒"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
        />
        <TouchableOpacity
          style={styles.chocoButton}
          onPress={async () => {
            if (!email || !username || !password) {
              Alert.alert('Please enter email, username, and password');
              return;
            }
            try {
              let used = await getUsedEmails();
              if (used.length >= 3 && !used.includes(email)) {
                Alert.alert('Device account limit reached (3 emails max). Please subscribe or use another device.');
                return;
              }
              await auth().signInWithEmailAndPassword(email, password).catch(async () => {
                await auth().createUserWithEmailAndPassword(email, password);
              });
              currentUser = { type: 'email', email, username, deviceId };
              await setUserOnline(email, username, true);
              navigation.navigate('Topics');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }}
        >
          <Text style={styles.chocoButtonText}>🍫 Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cakeButton}
          onPress={async () => {
            if (!username) {
              Alert.alert('Please enter a username');
              return;
            }
            try {
              await auth().signInAnonymously();
              currentUser = { type: 'guest', email: '', username, deviceId };
              await setUserOnline(deviceId, username, true);
              navigation.navigate('Topics');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }}
        >
          <Text style={styles.cakeButtonText}>🍰 Continue as Guest</Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginTop: 'auto', width: '100%', alignItems: 'center' }}>
        <TouchableOpacity
          style={styles.topicButton}
          onPress={() => navigation.navigate('Community')}
        >
          <Text style={styles.topicText}>🌍 Be Part of Community</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>🐨 Donate to keep Muskarao ad free and affordable for everyone! 💙 🐸</Text>
      </View>
    </SafeAreaView>
  );
}

function TopicsScreen({ navigation }) {
  const topics = [
    { text: '😔 Depression', key: 'Depression' },
    { text: '😞 Loneliness', key: 'Loneliness' },
    { text: '❤️ Relationships', key: 'Relationships' },
    { text: '💬 I just want to talk', key: 'Talk' },
  ];
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Talk to a Therapist or Listener</Text>
      <View style={styles.giftBoxContainer}>
        {topics.map((topic) => (
          <TouchableOpacity
            key={topic.key}
            style={styles.cakeButton}
            onPress={() => navigation.navigate('Listeners', { topic: topic.key })}
          >
            <Text style={styles.cakeButtonText}>{topic.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.header, { marginTop: 20 }]}>Support Each Other</Text>
      <TouchableOpacity style={styles.donutButton} onPress={() => navigation.navigate('Support')}>
        <Text style={styles.donutButtonText}>Talk to Others Like You</Text>
      </TouchableOpacity>
      <View style={{ marginTop: 'auto', width: '100%', alignItems: 'center' }}>
        <TouchableOpacity style={styles.donutButton} onPress={() => navigation.navigate('Details')}>
          <Text style={styles.donutButtonText}>🍩 My Sessions</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ListenersScreen({ route, navigation }) {
  const { topic } = route.params;
  const [listeners, setListeners] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('members').where('isOnline', '==', true)
      .onSnapshot(snapshot => {
        const available = snapshot.docs.map(doc => ({
          id: doc.id,
          name: `${doc.data().email} (${doc.data().role}${doc.data().rating ? `, ${doc.data().rating.toFixed(1)}/5` : ''})`
        }));
        setListeners(available);
      }, error => Alert.alert('Error', 'Failed to load listeners'));
    return unsub;
  }, []);

  const checkChatLimit = async () => {
    const userId = currentUser.type === 'email' ? currentUser.email : currentUser.deviceId;
    const activeChats = await getActiveChats(userId);
    return activeChats.length < 2;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Available Listeners for {topic}</Text>
      <FlatList
        style={{ marginTop: 20, width: '100%' }}
        data={listeners}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listenerButton}
            onPress={async () => {
              const subscribed = await isSubscribed(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
              if (!subscribed) {
                navigation.navigate('Payment', { targetId: item.id, topic, isListener: true });
              } else {
                const canChat = await checkChatLimit();
                if (!canChat) {
                  Alert.alert('Chat Limit Reached', 'You can only have 2 active conversations.');
                  return;
                }
                await addChatRequest(item.id, currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, topic);
                const chatId = [currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, item.id].sort().join('_');
                await addActiveChat(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, chatId, item.id, topic);
                navigation.navigate('Chat', { listener: item, topic });
                await incrementSessionCount(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
              }
            }}
          >
            <Text style={styles.topicText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function SupportScreen({ navigation }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('onlineUsers').where('isOnline', '==', true)
      .onSnapshot(snapshot => {
        const filtered = snapshot.docs
          .filter(doc => doc.id !== (currentUser.type === 'email' ? currentUser.email : currentUser.deviceId))
          .map(doc => ({
            id: doc.id,
            name: `${doc.data().username}${doc.data().rating ? ` (${doc.data().rating.toFixed(1)}/5)` : ''}`
          }));
        setUsers(filtered);
      }, error => Alert.alert('Error', 'Failed to load users'));
    return unsub;
  }, []);

  const checkChatLimit = async () => {
    const userId = currentUser.type === 'email' ? currentUser.email : currentUser.deviceId;
    const activeChats = await getActiveChats(userId);
    return activeChats.length < 2;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Online Users</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listenerButton}
            onPress={async () => {
              const subscribed = await isSubscribed(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
              if (!subscribed) {
                navigation.navigate('Payment', { targetId: item.id, topic: 'Support Chat', isListener: false });
              } else {
                const canChat = await checkChatLimit();
                if (!canChat) {
                  Alert.alert('Chat Limit Reached', 'You can only have 2 active conversations.');
                  return;
                }
                const chatId = [currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, item.id].sort().join('_');
                await addActiveChat(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, chatId, item.id, 'Support Chat');
                navigation.navigate('Chat', { listener: item, topic: 'Support Chat' });
                await incrementSessionCount(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
              }
            }}
          >
            <Text style={styles.topicText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function ChatScreen({ route, navigation }) {
  const { listener, topic } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const flatListRef = useRef(null);
  const chatId = [currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, listener.id].sort().join('_');
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour in seconds

  useEffect(() => {
    const loadLocal = async () => {
      const saved = await AsyncStorage.getItem(`chat_${chatId}`);
      if (saved) setMessages(JSON.parse(saved));
    };
    loadLocal();

    const unsubMessages = firestore().collection('chats').doc(chatId).collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(snapshot => {
        const cloudMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(cloudMessages);
        AsyncStorage.setItem(`chat_${chatId}`, JSON.stringify(cloudMessages));
      }, error => Alert.alert('Error', 'Failed to load messages'));

    const checkStartTime = async () => {
      const chatDoc = await firestore().collection('activeChats').doc(chatId).get();
      if (chatDoc.exists) {
        const { startTime } = chatDoc.data();
        const elapsed = (new Date() - startTime.toDate()) / 1000;
        const remaining = Math.max(0, 3600 - elapsed);
        setTimeLeft(remaining);
      }
    };
    checkStartTime();

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          navigation.navigate('Rating', { targetId: listener.id, topic });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      unsubMessages();
    };
  }, [chatId, navigation]);

  const sendMessage = async () => {
    if (input.trim() === '') return;
    try {
      if (editingId) {
        await firestore().collection('chats').doc(chatId).collection('messages').doc(editingId)
          .update({ text: input, editedAt: firestore.FieldValue.serverTimestamp() });
        setEditingId(null);
      } else {
        await firestore().collection('chats').doc(chatId).collection('messages').add({
          text: input,
          isMine: true,
          sender: currentUser.type === 'email' ? currentUser.email : currentUser.deviceId,
          timestamp: firestore.FieldValue.serverTimestamp(),
          topic
        });
      }
      setInput('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const deleteMessage = async (id) => {
    await firestore().collection('chats').doc(chatId).collection('messages').doc(id).delete();
  };

  const editMessage = (id, oldText) => {
    setEditingId(id);
    setInput(oldText);
  };

  const reportUser = () => {
    Alert.alert(
      "Report User",
      "Why are you reporting this user?",
      [
        { text: "Vulgar Language", onPress: () => saveReport("Vulgar Language") },
        { text: "Asking Personal Questions", onPress: () => saveReport("Asking Personal Questions") },
        { text: "Using App as Dating App", onPress: () => saveReport("Using App as Dating App") },
        { text: "Cancel", style: "cancel" }
      ],
      { cancelable: true }
    );
  };

  const saveReport = async (reason) => {
    try {
      await firestore().collection("badUsers").add({
        userId: listener.id,
        reportedBy: currentUser.type === 'email' ? currentUser.email : currentUser.deviceId,
        reason,
        timestamp: firestore.FieldValue.serverTimestamp()
      });
      Alert.alert("Report Sent", "The user has been reported.");
    } catch (error) {
      Alert.alert("Error", "Could not send report.");
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#ccc", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", textAlign: "center", flex: 1 }}>
            Chat with {listener.name} (Time Left: {formatTime(timeLeft)})
          </Text>
          <TouchableOpacity
            onPress={reportUser}
            style={{ backgroundColor: "rgba(255,0,0,0.3)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginLeft: 8 }}
          >
            <Text style={{ color: "red", fontSize: 12, fontWeight: "bold" }}>Report</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 10, flexGrow: 1, justifyContent: "flex-end" }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() =>
                item.isMine && Alert.alert("Message Options", "Choose an action", [
                  { text: "Edit", onPress: () => editMessage(item.id, item.text) },
                  { text: "Delete", onPress: () => deleteMessage(item.id), style: "destructive" },
                  { text: "Cancel", style: "cancel" }
                ])
              }
              style={{
                alignSelf: item.isMine ? "flex-end" : "flex-start",
                marginVertical: 4,
                padding: 8,
                backgroundColor: item.isMine ? "#007AFF" : "#E5E5EA",
                borderRadius: 6,
                maxWidth: "80%"
              }}
            >
              <Text style={{ fontSize: 16, color: item.isMine ? "#fff" : "#000", flexShrink: 1 }}>
                {item.text}
              </Text>
            </TouchableOpacity>
          )}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={styles.chatInputContainer}>
          <TextInput
            placeholder="Type your message"
            value={input}
            onChangeText={setInput}
            style={styles.chatInput}
          />
          <Button title={editingId ? "Update" : "Send"} onPress={sendMessage} />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function RatingScreen({ route, navigation }) {
  const { targetId, topic } = route.params;
  const [rating, setRating] = useState(0);

  const submit = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert('Please select a rating between 1 and 5');
      return;
    }
    await submitRating(targetId, rating);
    await removeActiveChat([currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, targetId].sort().join('_'));
    navigation.navigate('Topics');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Rate Your Experience</Text>
      <Text>Rate your conversation about {topic} (1-5 stars):</Text>
      <View style={{ flexDirection: 'row', marginVertical: 20 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <Text style={{ fontSize: 30, color: star <= rating ? '#ffd700' : '#ccc' }}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.chocoButton} onPress={submit}>
        <Text style={styles.chocoButtonText}>Submit Rating</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function PaymentScreen({ route, navigation }) {
  const { targetId, topic, isListener } = route.params;

  const subscribe = async () => {
    await setSubscribed(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
    Alert.alert('Subscribed successfully! You can now have unlimited chats for 1 week.');
    const chatId = [currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, targetId].sort().join('_');
    await addActiveChat(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, chatId, targetId, topic);
    if (isListener) {
      await addChatRequest(targetId, currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, topic);
    }
    navigation.navigate('Chat', { listener: { id: targetId, name: isListener ? `${targetId} (Listener)` : targetId }, topic });
    await incrementSessionCount(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Subscription Required</Text>
      <Text style={{ textAlign: 'center', marginVertical: 10 }}>
        Please pay just 99 PKR to help cover the app's operating expenses and it allows them to have as many chats as they want for a week.
      </Text>
      <Image
        source={require('./assets/ep.jpg')}
        style={{ width: 200, height: 200, marginVertical: 20 }}
      />
      <TouchableOpacity style={styles.chocoButton} onPress={subscribe}>
        <Text style={styles.chocoButtonText}>Confirm Payment</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function DetailsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>My Past Sessions 📜</Text>
      {sessionHistory.length === 0 ? (
        <Text>No sessions yet.</Text>
      ) : (
        <FlatList
          data={sessionHistory}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.sessionBox}>
              <Text style={{ fontWeight: 'bold' }}>{item.listener} ({item.topic})</Text>
              <Text>Last msg: {item.lastMessage}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function CommunityScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  const submitRequest = async () => {
    if (email && username) {
      await addJoiningRequest(email, username);
      Alert.alert('Request Submitted 🎉', 'Thanks! Please send us an Email or WhatsApp message with your basic information and life experiences so we can process your request.');
      setEmail('');
      setUsername('');
    } else {
      Alert.alert('Please enter both email and username');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Be Part of the Community 🌍</Text>
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginVertical: 10 }}>Step 1️⃣: Your Details</Text>
      <TextInput placeholder="Enter Username" value={username} onChangeText={setUsername} style={styles.input} />
      <TextInput placeholder="Enter Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
      <TouchableOpacity style={styles.topicButton} onPress={submitRequest}>
        <Text style={styles.topicText}>Submit Email</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginVertical: 20 }}>Step 2️⃣: Send More Info</Text>
      <TouchableOpacity style={styles.topicButton} onPress={() => Linking.openURL('mailto:24hourstired@gmail.com')}>
        <Text style={styles.topicText}>📧 Send us an Email</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.topicButton} onPress={() => Linking.openURL('https://wa.me/923424323203')}>
        <Text style={styles.topicText}>💬 Chat on WhatsApp</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MembersScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = async () => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
      const memberDoc = await firestore().collection('members').doc(email).get();
      if (memberDoc.exists) {
        const member = memberDoc.data();
        await firestore().collection('members').doc(email).update({ isOnline: true });
        currentMember = { email, role: member.role, isAdmin: email === ADMIN_EMAIL, isOnline: true };
        navigation.navigate('Dashboard');
      } else {
        Alert.alert('Invalid credentials or not approved');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Members Login 🌍</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />
      <TouchableOpacity style={styles.topicButton} onPress={login}>
        <Text style={styles.topicText}>Login</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MemberChatsScreen() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('chatRequests')
      .where('memberEmail', '==', currentMember.email)
      .onSnapshot(snapshot => {
        setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, error => Alert.alert('Error', 'Failed to load requests'));
    return unsub;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Chat Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text>{item.userId} - {item.topic}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function JoiningRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = firestore().collection('joiningRequests')
      .onSnapshot(snapshot => {
        setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, error => Alert.alert('Error', 'Failed to load requests'));
    return unsub;
  }, []);

  const approve = async (email, role) => {
    await approveJoiningRequest(email, role);
  };

  const reject = async (email) => {
    await rejectJoiningRequest(email);
  };

  const filtered = requests.filter((r) => (
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.username?.toLowerCase().includes(search.toLowerCase())
  ));

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Joining Requests</Text>
      <TextInput placeholder="Search email or username" value={search} onChangeText={setSearch} style={styles.input} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text style={{ fontWeight: 'bold' }}>{item.username}</Text>
            <Text>{item.email}</Text>
            <TouchableOpacity onPress={() => approve(item.email, 'Therapist')}>
              <Text>✅ Approve as Therapist</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => approve(item.email, 'Listener')}>
              <Text>✅ Approve as Listener</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => approve(item.email, 'Volunteer')}>
              <Text>✅ Approve as Volunteer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => reject(item.email)}>
              <Text style={{ color: 'red' }}>❌ Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function BadUsersScreen() {
  const [badUsers, setBadUsers] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('badUsers')
      .onSnapshot(snapshot => {
        setBadUsers(snapshot.docs.map(doc => doc.id));
      }, error => Alert.alert('Error', 'Failed to load bad users'));
    return unsub;
  }, []);

  const block = async (deviceIdOrEmail) => {
    await blockBadUser(deviceIdOrEmail);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Bad Users</Text>
      <FlatList
        data={badUsers}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text>{item}</Text>
            <TouchableOpacity onPress={() => block(item)}>
              <Text>Block</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function BadMembersScreen() {
  const [badMembers, setBadMembers] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('badMembers')
      .onSnapshot(snapshot => {
        setBadMembers(snapshot.docs.map(doc => doc.id));
      }, error => Alert.alert('Error', 'Failed to load bad members'));
    return unsub;
  }, []);

  const block = async (email) => {
    await blockBadMember(email);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Bad Members</Text>
      <FlatList
        data={badMembers}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text>{item}</Text>
            <TouchableOpacity onPress={() => block(item)}>
              <Text>Block</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function DashboardScreen() {
  return (
    <Tab.Navigator
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerTitle: currentMember.isAdmin ? 'Admin Dashboard' : 'Member Dashboard',
        headerRight: () => (
          currentMember.email ? (
            <TouchableOpacity onPress={() => logout(navigation)} style={{ marginRight: 12 }}>
              <Text style={{ color: '#dc3545', fontWeight: 'bold' }}>Logout</Text>
            </TouchableOpacity>
          ) : null
        ),
      })}
    >
      <Tab.Screen name="Chats" component={MemberChatsScreen} />
      {currentMember.isAdmin && <Tab.Screen name="Joining Requests" component={JoiningRequestsScreen} />}
      {currentMember.isAdmin && <Tab.Screen name="Bad Users" component={BadUsersScreen} />}
      {currentMember.isAdmin && <Tab.Screen name="Bad Members" component={BadMembersScreen} />}
    </Tab.Navigator>
  );
}

function HeaderMenu({ navigation }) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} style={{ paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 22 }}>⋮</Text>
      </TouchableOpacity>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setVisible(false)} />
        <View style={styles.menuSheet}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setVisible(false); navigation.navigate('Members'); }}>
            <Text>Members</Text>
          </TouchableOpacity>
          {currentUser?.type && (
            <TouchableOpacity style={styles.menuItem} onPress={() => { setVisible(false); logout(navigation); }}>
              <Text>Logout</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            headerRight: () => <HeaderMenu navigation={navigation} />,
          })}
        />
        <Stack.Screen name="Topics" component={TopicsScreen} />
        <Stack.Screen name="Listeners" component={ListenersScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
        <Stack.Screen name="Community" component={CommunityScreen} />
        <Stack.Screen name="Members" component={MembersScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="Rating" component={RatingScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  welcomeText: { fontSize: 18, color: '#ff69b4', marginBottom: 5, textAlign: 'center' },
  welcomeSubText: { fontSize: 16, color: '#666', marginBottom: 20, textAlign: 'center' },
  footer: { marginTop: 10, fontSize: 14, color: 'gray', textAlign: 'center' },
  input: { borderWidth: 1, padding: 8, marginVertical: 10, width: '80%', borderRadius: 8, borderColor: '#ccc' },
  topicButton: {
    padding: 12,
    backgroundColor: '#007bff',
    marginVertical: 8,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  listenerButton: { padding: 12, backgroundColor: '#28a745', marginVertical: 8, borderRadius: 8, width: '100%', alignItems: 'center' },
  topicText: { color: 'white', fontWeight: 'bold' },
  chatInputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  chatInput: { flex: 1, borderWidth: 1, padding: 8, marginRight: 8, borderRadius: 8 },
  sessionBox: { borderWidth: 1, borderColor: '#ddd', padding: 10, marginVertical: 5, borderRadius: 6, width: '100%' },
  cakeButton: {
    padding: 14,
    backgroundColor: '#ff9999',
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginVertical: 8,
  },
  cakeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  chocoButton: {
    padding: 12,
    backgroundColor: '#8b4513',
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginVertical: 8,
  },
  chocoButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  donutButton: {
    padding: 12,
    backgroundColor: '#9932cc',
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginVertical: 8,
  },
  donutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  giftBoxContainer: {
    width: '90%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffd700',
    borderRadius: 15,
    padding: 15,
    marginVertical: 10,
    backgroundColor: '#fff5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)' },
  menuSheet: { position: 'absolute', top: 60, right: 12, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 8, width: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
});
};

const isSubscribed = async (email) => {
  const subs = await AsyncStorage.getItem('subscribedEmails');
  const parsed = JSON.parse(subs || '[]');
  return parsed.includes(email);
};

const setSubscribed = async (email) => {
  const subs = await AsyncStorage.getItem('subscribedEmails');
  let parsed = JSON.parse(subs || '[]');
  if (!parsed.includes(email)) {
    parsed.push(email);
    await AsyncStorage.setItem('subscribedEmails', JSON.stringify(parsed));
  }
};

const getUsedEmails = async () => {
  const used = await AsyncStorage.getItem('usedEmails');
  return JSON.parse(used || '[]');
};

/* ------ JOINING REQUESTS (apply to be member) ------ */
const getJoiningRequests = async () => {
  const requests = await AsyncStorage.getItem('joiningRequests');
  return JSON.parse(requests || '[]'); // [{email, username}]
};

const addJoiningRequest = async (email, username) => {
  const requests = await getJoiningRequests();
  if (!requests.find(r => r.email === email)) {
    requests.push({ email, username });
    await AsyncStorage.setItem('joiningRequests', JSON.stringify(requests));
  }
};

const approveJoiningRequest = async (email, role) => {
  // remove from joining requests
  let requests = await getJoiningRequests();
  requests = requests.filter(req => req.email !== email);
  await AsyncStorage.setItem('joiningRequests', JSON.stringify(requests));

  // add to members (default offline)
  let members = await getMembers();
  if (!members.find(m => m.email === email)) {
    members.push({ email, role, isOnline: false });
    await AsyncStorage.setItem('members', JSON.stringify(members));
  }
};

const rejectJoiningRequest = async (email) => {
  let requests = await getJoiningRequests();
  requests = requests.filter(req => req.email !== email);
  await AsyncStorage.setItem('joiningRequests', JSON.stringify(requests));
};

/* ------ MEMBERS (therapists/listeners/volunteers/admin) ------ */
const getMembers = async () => {
  const members = await AsyncStorage.getItem('members');
  return JSON.parse(members || '[]');
};

/* ------ BAD LISTS ------ */
const getBadUsers = async () => {
  const bad = await AsyncStorage.getItem('badUsers');
  return JSON.parse(bad || '[]');
};

const addBadUser = async (email) => {
  const bad = await getBadUsers();
  if (!bad.includes(email)) {
    bad.push(email);
    await AsyncStorage.setItem('badUsers', JSON.stringify(bad));
  }
};

const blockBadUser = async (email) => {
  let bad = await getBadUsers();
  bad = bad.filter(b => b !== email);
  await AsyncStorage.setItem('badUsers', JSON.stringify(bad));
};

const getBadMembers = async () => {
  const bad = await AsyncStorage.getItem('badMembers');
  return JSON.parse(bad || '[]');
};

const addBadMember = async (email) => {
  const bad = await getBadMembers();
  if (!bad.includes(email)) {
    bad.push(email);
    await AsyncStorage.setItem('badMembers', JSON.stringify(bad));
  }
};

const blockBadMember = async (email) => {
  let bad = await getBadMembers();
  bad = bad.filter(b => b !== email);
  await AsyncStorage.setItem('badMembers', JSON.stringify(bad));
};

/* ------ CHAT REQUESTS (to members) ------ */
const getChatRequests = async (memberEmail) => {
  const requests = await AsyncStorage.getItem('chatRequests');
  const parsed = JSON.parse(requests || '{}');
  return parsed[memberEmail] || [];
};

const addChatRequest = async (memberEmail, userEmail, topic) => {
  const requests = await AsyncStorage.getItem('chatRequests');
  let parsed = JSON.parse(requests || '{}');
  if (!parsed[memberEmail]) parsed[memberEmail] = [];
  parsed[memberEmail].push({ userEmail, topic, status: 'pending' });
  await AsyncStorage.setItem('chatRequests', JSON.stringify(parsed));
};

/* ------ CHAT HISTORY (per conversation) ------ */
const getChatHistory = async (chatId) => {
  const history = await AsyncStorage.getItem(`chat_${chatId}`);
  return JSON.parse(history || '[]');
};

const saveChatHistory = async (chatId, messages) => {
  await AsyncStorage.setItem(`chat_${chatId}`, JSON.stringify(messages));
};


/* ------ ONLINE USERS (normal users, not members) ------ */
const getOnlineUsers = async () => {
  const raw = await AsyncStorage.getItem('onlineUsers');
  return JSON.parse(raw || '[]'); // [{email, username, isOnline}]
};

const setUserOnline = async (email, username, isOnline) => {
  let users = await getOnlineUsers();

  // If guest -> remove any old guest entries before adding new one
  if (!email) {
    users = users.filter(u => !u.email); // remove all old guests
    users.push({ email: null, username, isOnline });
  } else {
    // Normal user -> update or add
    const existingIndex = users.findIndex(u => u.email === email);
    if (existingIndex !== -1) {
      users[existingIndex] = { email, username, isOnline };
    } else {
      users.push({ email, username, isOnline });
    }
  }

  // Remove duplicates by email (only applies to registered users)
  users = users.filter((u, index, self) =>
    index === self.findIndex(other => other.email === u.email)
  );

  // Only keep users marked as online
  users = users.filter(u => u.isOnline);

  await AsyncStorage.setItem('onlineUsers', JSON.stringify(users));
};



/* -------------------------
   Logout helper (global)
   ------------------------- */
const logout = async (navigation) => {
  // mark member offline if logged in
  if (currentMember?.email) {
    let members = await getMembers();
    members = members.map(m => (m.email === currentMember.email ? { ...m, isOnline: false } : m));
    await AsyncStorage.setItem('members', JSON.stringify(members));
  }
  // mark normal user offline if logged in
  if (currentUser?.type) {
    const emailKey = currentUser.email || `guest:${currentUser.username}`;
    await setUserOnline(emailKey, currentUser.username, false);
  }
  currentUser = { type: null, email: '', username: '' };
  currentMember = { email: '', role: '', isAdmin: false, isOnline: false };

  navigation.navigate('Home'); // simpler, avoids freeze
};



/* -------------------------
   Screens
   ------------------------- */

function HomeScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>🐨 Welcome to Muskarao! 🐸</Text>
      <Text style={styles.welcomeText}>Koala & Kermit are here to cheer you up! 😊🎉</Text>
      <Text style={styles.welcomeSubText}>Wave hello 👋 and let's get started!</Text>

      <View style={styles.giftBoxContainer}>
        {/* Username for display */}
        <TextInput
          placeholder="Enter Username 👤"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />
        {/* Email login */}
        <TextInput
          placeholder="Login with Email 📧"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
        />

        {/* Continue with Email */}
        <TouchableOpacity
          style={styles.chocoButton}
          onPress={async () => {
            if (!email || !username) {
              Alert.alert('Please enter both email and username');
              return;
            }
            let used = await getUsedEmails();
            if (used.includes(email) || used.length < 3) {
              if (!used.includes(email)) {
                used.push(email);
                await AsyncStorage.setItem('usedEmails', JSON.stringify(used));
              }
              currentUser = { type: 'email', email, username };
              await setUserOnline(email, username, true);
              navigation.navigate('Topics');
            } else {
              Alert.alert('Device account limit reached (3 emails max). Please subscribe or use another device.');
            }
          }}
        >
          <Text style={styles.chocoButtonText}>🍫 Continue</Text>
        </TouchableOpacity>

        {/* Continue as Guest */}
        <TouchableOpacity
          style={styles.cakeButton}
          onPress={async () => {
            if (!username) {
              Alert.alert('Please enter a username');
              return;
            }
            const guestEmailKey = `guest:${username}`;
            currentUser = { type: 'guest', email: '', username };
            await setUserOnline(guestEmailKey, username, true);
            navigation.navigate('Topics');
          }}
        >
          <Text style={styles.cakeButtonText}>🍰 Continue as Guest</Text>
        </TouchableOpacity>
      </View>

      {/* Footer with Be Part of Community Button */}
      <View style={{ marginTop: 'auto', width: '100%', alignItems: 'center' }}>
        <TouchableOpacity
          style={styles.topicButton}
          onPress={() => navigation.navigate('Community')}
        >
          <Text style={styles.topicText}>🌍 Be Part of Community</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>🐨 Donate to keep Muskarao ad free and affordable for everyone! 💙 🐸</Text>
      </View>
    </SafeAreaView>
  );
}

function TopicsScreen({ navigation }) {
  const topics = [
    { text: '😔 Depression', key: 'Depression' },
    { text: '😞 Loneliness', key: 'Loneliness' },
    { text: '❤️ Relationships', key: 'Relationships' },
    { text: '💬 I just want to talk', key: 'Talk' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Talk to a Therapist or Listener</Text>
      <View style={styles.giftBoxContainer}>
        {topics.map((topic) => (
          <TouchableOpacity
            key={topic.key}
            style={styles.cakeButton}
            onPress={() => navigation.navigate('Listeners', { topic: topic.key })}
          >
            <Text style={styles.cakeButtonText}>{topic.text}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.header, { marginTop: 20 }]}>Support Each Other</Text>
      <TouchableOpacity style={styles.donutButton} onPress={() => navigation.navigate('Support')}>
        <Text style={styles.donutButtonText}>Talk to Others Like You</Text>
      </TouchableOpacity>

      {/* My Sessions */}
      <View style={{ marginTop: 'auto', width: '100%', alignItems: 'center' }}>
        <TouchableOpacity style={styles.donutButton} onPress={() => navigation.navigate('Details')}>
          <Text style={styles.donutButtonText}>🍩 My Sessions</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ListenersScreen({ route, navigation }) {
  const { topic } = route.params;
  const [listeners, setListeners] = useState([]);

  useEffect(() => {
    const loadListeners = async () => {
      const members = await getMembers();
      // Only show members who are online
      const available = members
        .filter((m) => m.isOnline)
        .map((m) => ({ id: m.email, name: `${m.email} (${m.role})` }));
      setListeners(available);
    };
    const unsub = navigation.addListener('focus', loadListeners);
    loadListeners();
    return unsub;
  }, [navigation]);

  const startChat = async (listener, topic) => {
    if (!currentUser.type) {
      Alert.alert('Please login first');
      navigation.navigate('Home');
      return;
    }

    let allow = false;
    if (currentUser.type === 'guest') {
      const count = await getSessionCount('guest');
      if (count < 1) {
        allow = true;
      } else {
        Alert.alert('Guest limit reached, please login with email');
        navigation.navigate('Home');
        return;
      }
    } else {
      const subscribed = await isSubscribed(currentUser.email);
      if (subscribed) {
        allow = true;
      } else {
        const count = await getSessionCount('email', currentUser.email);
        if (count < 3) {
          allow = true;
        } else {
          navigation.navigate('Subscribe', { email: currentUser.email });
          return;
        }
      }
    }

    if (allow) {
      await addChatRequest(listener.id, currentUser.email || `guest:${currentUser.username}`, topic);
      navigation.navigate('Chat', { listener, topic });
      await incrementSessionCount(currentUser.type, currentUser.email);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Available Listeners for {topic}</Text>
      <FlatList
        style={{ marginTop: 20, width: '100%' }}
        data={listeners}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.listenerButton} onPress={async () => await startChat(item, topic)}>
            <Text style={styles.topicText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function SupportScreen({ navigation }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const loadUsers = async () => {
      const all = await getOnlineUsers();
      const filtered = all.filter((u) => u.isOnline && (currentUser.email ? u.email !== currentUser.email : u.email !== `guest:${currentUser.username}`));
      setUsers(filtered.map((u) => ({ id: u.email, name: u.username })));
    };
    const unsub = navigation.addListener('focus', loadUsers);
    loadUsers();
    return unsub;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Online Users</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listenerButton}
            onPress={() => navigation.navigate('Chat', { listener: item, topic: 'Support Chat' })}
          >
            <Text style={styles.topicText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}


function ChatScreen({ route }) {
  const { listener } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState(null);

  const flatListRef = useRef(null);
  const storageKey = `chat_${listener.id}`;

  useEffect(() => {
    const loadMessages = async () => {
      const saved = await AsyncStorage.getItem(storageKey);
      if (saved) setMessages(JSON.parse(saved));
    };
    loadMessages();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages]);

  const sendMessage = () => {
    if (input.trim() === '') return;

    if (editingId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, text: input } : m))
      );
      setEditingId(null);
    } else {
      const newMessage = {
        id: Date.now().toString(),
        text: input,
        isMine: true,
      };
      setMessages((prev) => [...prev, newMessage]);
    }

    setInput('');
  };

  const deleteMessage = (id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const editMessage = (id, oldText) => {
    setEditingId(id);
    setInput(oldText);
  };

  // ✅ Report user with reason
  const reportUser = () => {
    Alert.alert(
      "Report User",
      "Why are you reporting this user?",
      [
        {
          text: "Vulgar Language",
          onPress: () => saveReport("Vulgar Language"),
        },
        {
          text: "Asking Personal Questions",
          onPress: () => saveReport("Asking Personal Questions"),
        },
        {
          text: "Using App as Dating App",
          onPress: () => saveReport("Using App as Dating App"),
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  // ✅ Save report to backend (Firestore or your API)
  const saveReport = async (reason) => {
    try {
      // Example Firestore call:
      await firestore()
        .collection("BadUsers")
        .add({
          userId: listener.id || listener.email,
          reportedBy: "currentUserIdOrEmail", // replace with actual logged-in user
          reason,
          timestamp: new Date(),
        });

      Alert.alert("Report Sent", "The user has been reported.");
    } catch (err) {
      console.error("Error reporting user:", err);
      Alert.alert("Error", "Could not send report.");
    }
  };
import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  SafeAreaView,
  Text,
  View,
  Button,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Linking,
  Image
} from "react-native";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import * as Device from 'expo-device'; // For device ID
import { v4 as uuidv4 } from 'uuid'; // For fallback UUID

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

let sessionHistory = []; // Store summary of sessions (local)
let currentUser = { type: null, email: '', username: '', deviceId: '' };
let currentMember = { email: '', role: '', isAdmin: false, isOnline: false };
const ADMIN_EMAIL = '24hourstired@gmail.com';

/* -------------------------
   AsyncStorage helpers
   ------------------------- */
const getSessionCount = async (deviceIdOrEmail) => {
  const counts = await AsyncStorage.getItem('sessionCounts');
  const parsed = JSON.parse(counts || '{}');
  return parsed[deviceIdOrEmail] || 0;
};

const incrementSessionCount = async (deviceIdOrEmail) => {
  const counts = await AsyncStorage.getItem('sessionCounts');
  const parsed = JSON.parse(counts || '{}');
  parsed[deviceIdOrEmail] = (parsed[deviceIdOrEmail] || 0) + 1;
  await AsyncStorage.setItem('sessionCounts', JSON.stringify(parsed));
};

/* -------------------------
   Firestore helpers
   ------------------------- */
const isSubscribed = async (deviceIdOrEmail) => {
  const doc = await firestore().collection('subscriptions').doc(deviceIdOrEmail).get();
  if (doc.exists) {
    const { subscribed, expiry } = doc.data();
    if (subscribed && expiry && expiry.toDate() > new Date()) {
      return true;
    }
    if (expiry && expiry.toDate() <= new Date()) {
      await firestore().collection('subscriptions').doc(deviceIdOrEmail).delete();
    }
  }
  return false;
};

const setSubscribed = async (deviceIdOrEmail) => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7); // 1 week
  await firestore().collection('subscriptions').doc(deviceIdOrEmail).set({
    subscribed: true,
    expiry: firestore.Timestamp.fromDate(expiry)
  });
};

const getUsedEmails = async () => {
  const counts = await AsyncStorage.getItem('sessionCounts');
  const parsed = JSON.parse(counts || '{}');
  return Object.keys(parsed).filter(key => key.includes('@'));
};

const getJoiningRequests = async () => {
  const snapshot = await firestore().collection('joiningRequests').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const addJoiningRequest = async (email, username) => {
  await firestore().collection('joiningRequests').add({
    email,
    username,
    createdAt: firestore.FieldValue.serverTimestamp()
  });
};

const approveJoiningRequest = async (email, role) => {
  await firestore().collection('joiningRequests').where('email', '==', email).get()
    .then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete()));
  await firestore().collection('members').doc(email).set({
    email,
    role,
    isOnline: false,
    rating: 0,
    ratingCount: 0
  });
};

const rejectJoiningRequest = async (email) => {
  await firestore().collection('joiningRequests').where('email', '==', email).get()
    .then(snapshot => snapshot.docs.forEach(doc => doc.ref.delete()));
};

const getMembers = async () => {
  const snapshot = await firestore().collection('members').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getBadUsers = async () => {
  const snapshot = await firestore().collection('badUsers').get();
  return snapshot.docs.map(doc => doc.id);
};

const addBadUser = async (deviceIdOrEmail) => {
  await firestore().collection('badUsers').doc(deviceIdOrEmail).set({
    reportedAt: firestore.FieldValue.serverTimestamp()
  });
};

const blockBadUser = async (deviceIdOrEmail) => {
  await firestore().collection('badUsers').doc(deviceIdOrEmail).delete();
};

const getBadMembers = async () => {
  const snapshot = await firestore().collection('badMembers').get();
  return snapshot.docs.map(doc => doc.id);
};

const addBadMember = async (email) => {
  await firestore().collection('badMembers').doc(email).set({
    reportedAt: firestore.FieldValue.serverTimestamp()
  });
};

const blockBadMember = async (email) => {
  await firestore().collection('badMembers').doc(email).delete();
};

const getChatRequests = async (memberEmail) => {
  const snapshot = await firestore().collection('chatRequests').where('memberEmail', '==', memberEmail).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const addChatRequest = async (memberEmail, userId, topic) => {
  await firestore().collection('chatRequests').add({
    memberEmail,
    userId,
    topic,
    status: 'pending',
    createdAt: firestore.FieldValue.serverTimestamp()
  });
};

const getActiveChats = async (deviceIdOrEmail) => {
  const snapshot = await firestore().collection('activeChats').where('userId', '==', deviceIdOrEmail).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const addActiveChat = async (deviceIdOrEmail, chatId, otherId, topic) => {
  await firestore().collection('activeChats').doc(chatId).set({
    userId: deviceIdOrEmail,
    otherId,
    topic,
    startTime: firestore.FieldValue.serverTimestamp()
  });
};

const removeActiveChat = async (chatId) => {
  await firestore().collection('activeChats').doc(chatId).delete();
};

const getChatHistory = async (chatId) => {
  const local = await AsyncStorage.getItem(`chat_${chatId}`);
  if (local) return JSON.parse(local);
  const snapshot = await firestore().collection('chats').doc(chatId).collection('messages').orderBy('timestamp', 'asc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const saveChatHistory = async (chatId, messages) => {
  await AsyncStorage.setItem(`chat_${chatId}`, JSON.stringify(messages));
};

const getOnlineUsers = async () => {
  const snapshot = await firestore().collection('onlineUsers').where('isOnline', '==', true).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const setUserOnline = async (deviceIdOrEmail, username, isOnline) => {
  const userRef = firestore().collection('onlineUsers').doc(deviceIdOrEmail);
  await userRef.set({
    username,
    isOnline,
    lastSeen: firestore.FieldValue.serverTimestamp(),
    rating: 0,
    ratingCount: 0
  }, { merge: true });
  if (isOnline) {
    userRef.onDisconnect().update({ isOnline: false });
  }
};

const submitRating = async (targetId, rating) => {
  const doc = await firestore().collection(currentUser.type === 'email' ? 'members' : 'onlineUsers').doc(targetId).get();
  if (doc.exists) {
    const { rating: currentRating, ratingCount } = doc.data();
    const newCount = ratingCount + 1;
    const newRating = ((currentRating * ratingCount) + rating) / newCount;
    await firestore().collection(currentUser.type === 'email' ? 'members' : 'onlineUsers').doc(targetId).update({
      rating: newRating,
      ratingCount: newCount
    });
  }
};

/* -------------------------
   Logout helper
   ------------------------- */
const logout = async (navigation) => {
  try {
    if (currentMember.email) {
      await firestore().collection('members').doc(currentMember.email).update({ isOnline: false });
    }
    if (currentUser.type) {
      const userId = currentUser.type === 'email' ? currentUser.email : currentUser.deviceId;
      await setUserOnline(userId, currentUser.username, false);
      await auth().signOut();
    }
    currentUser = { type: null, email: '', username: '', deviceId: '' };
    currentMember = { email: '', role: '', isAdmin: false, isOnline: false };
    navigation.navigate('Home');
  } catch (error) {
    Alert.alert('Error', 'Failed to log out');
  }
};

/* -------------------------
   Screens
   ------------------------- */
function HomeScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    const getDeviceId = async () => {
      let id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = Device.deviceName ? `${Device.deviceName}_${uuidv4()}` : uuidv4();
        await AsyncStorage.setItem('deviceId', id);
      }
      setDeviceId(id);
    };
    getDeviceId();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>🐨 Welcome to Muskarao! 🐸</Text>
      <Text style={styles.welcomeText}>Koala & Kermit are here to cheer you up! 😊🎉</Text>
      <Text style={styles.welcomeSubText}>Wave hello 👋 and let's get started!</Text>
      <View style={styles.giftBoxContainer}>
        <TextInput
          placeholder="Enter Username 👤"
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />
        <TextInput
          placeholder="Login with Email 📧"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Password 🔒"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
        />
        <TouchableOpacity
          style={styles.chocoButton}
          onPress={async () => {
            if (!email || !username || !password) {
              Alert.alert('Please enter email, username, and password');
              return;
            }
            try {
              let used = await getUsedEmails();
              if (used.length >= 3 && !used.includes(email)) {
                Alert.alert('Device account limit reached (3 emails max). Please subscribe or use another device.');
                return;
              }
              await auth().signInWithEmailAndPassword(email, password).catch(async () => {
                await auth().createUserWithEmailAndPassword(email, password);
              });
              currentUser = { type: 'email', email, username, deviceId };
              await setUserOnline(email, username, true);
              navigation.navigate('Topics');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }}
        >
          <Text style={styles.chocoButtonText}>🍫 Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cakeButton}
          onPress={async () => {
            if (!username) {
              Alert.alert('Please enter a username');
              return;
            }
            try {
              await auth().signInAnonymously();
              currentUser = { type: 'guest', email: '', username, deviceId };
              await setUserOnline(deviceId, username, true);
              navigation.navigate('Topics');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }}
        >
          <Text style={styles.cakeButtonText}>🍰 Continue as Guest</Text>
        </TouchableOpacity>
      </View>
      <View style={{ marginTop: 'auto', width: '100%', alignItems: 'center' }}>
        <TouchableOpacity
          style={styles.topicButton}
          onPress={() => navigation.navigate('Community')}
        >
          <Text style={styles.topicText}>🌍 Be Part of Community</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>🐨 Donate to keep Muskarao ad free and affordable for everyone! 💙 🐸</Text>
      </View>
    </SafeAreaView>
  );
}

function TopicsScreen({ navigation }) {
  const topics = [
    { text: '😔 Depression', key: 'Depression' },
    { text: '😞 Loneliness', key: 'Loneliness' },
    { text: '❤️ Relationships', key: 'Relationships' },
    { text: '💬 I just want to talk', key: 'Talk' },
  ];
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Talk to a Therapist or Listener</Text>
      <View style={styles.giftBoxContainer}>
        {topics.map((topic) => (
          <TouchableOpacity
            key={topic.key}
            style={styles.cakeButton}
            onPress={() => navigation.navigate('Listeners', { topic: topic.key })}
          >
            <Text style={styles.cakeButtonText}>{topic.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.header, { marginTop: 20 }]}>Support Each Other</Text>
      <TouchableOpacity style={styles.donutButton} onPress={() => navigation.navigate('Support')}>
        <Text style={styles.donutButtonText}>Talk to Others Like You</Text>
      </TouchableOpacity>
      <View style={{ marginTop: 'auto', width: '100%', alignItems: 'center' }}>
        <TouchableOpacity style={styles.donutButton} onPress={() => navigation.navigate('Details')}>
          <Text style={styles.donutButtonText}>🍩 My Sessions</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ListenersScreen({ route, navigation }) {
  const { topic } = route.params;
  const [listeners, setListeners] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('members').where('isOnline', '==', true)
      .onSnapshot(snapshot => {
        const available = snapshot.docs.map(doc => ({
          id: doc.id,
          name: `${doc.data().email} (${doc.data().role}${doc.data().rating ? `, ${doc.data().rating.toFixed(1)}/5` : ''})`
        }));
        setListeners(available);
      }, error => Alert.alert('Error', 'Failed to load listeners'));
    return unsub;
  }, []);

  const checkChatLimit = async () => {
    const userId = currentUser.type === 'email' ? currentUser.email : currentUser.deviceId;
    const activeChats = await getActiveChats(userId);
    return activeChats.length < 2;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Available Listeners for {topic}</Text>
      <FlatList
        style={{ marginTop: 20, width: '100%' }}
        data={listeners}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listenerButton}
            onPress={async () => {
              const subscribed = await isSubscribed(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
              if (!subscribed) {
                navigation.navigate('Payment', { targetId: item.id, topic, isListener: true });
              } else {
                const canChat = await checkChatLimit();
                if (!canChat) {
                  Alert.alert('Chat Limit Reached', 'You can only have 2 active conversations.');
                  return;
                }
                await addChatRequest(item.id, currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, topic);
                const chatId = [currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, item.id].sort().join('_');
                await addActiveChat(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, chatId, item.id, topic);
                navigation.navigate('Chat', { listener: item, topic });
                await incrementSessionCount(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
              }
            }}
          >
            <Text style={styles.topicText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function SupportScreen({ navigation }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('onlineUsers').where('isOnline', '==', true)
      .onSnapshot(snapshot => {
        const filtered = snapshot.docs
          .filter(doc => doc.id !== (currentUser.type === 'email' ? currentUser.email : currentUser.deviceId))
          .map(doc => ({
            id: doc.id,
            name: `${doc.data().username}${doc.data().rating ? ` (${doc.data().rating.toFixed(1)}/5)` : ''}`
          }));
        setUsers(filtered);
      }, error => Alert.alert('Error', 'Failed to load users'));
    return unsub;
  }, []);

  const checkChatLimit = async () => {
    const userId = currentUser.type === 'email' ? currentUser.email : currentUser.deviceId;
    const activeChats = await getActiveChats(userId);
    return activeChats.length < 2;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Online Users</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listenerButton}
            onPress={async () => {
              const subscribed = await isSubscribed(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
              if (!subscribed) {
                navigation.navigate('Payment', { targetId: item.id, topic: 'Support Chat', isListener: false });
              } else {
                const canChat = await checkChatLimit();
                if (!canChat) {
                  Alert.alert('Chat Limit Reached', 'You can only have 2 active conversations.');
                  return;
                }
                const chatId = [currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, item.id].sort().join('_');
                await addActiveChat(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, chatId, item.id, 'Support Chat');
                navigation.navigate('Chat', { listener: item, topic: 'Support Chat' });
                await incrementSessionCount(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
              }
            }}
          >
            <Text style={styles.topicText}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function ChatScreen({ route, navigation }) {
  const { listener, topic } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const flatListRef = useRef(null);
  const chatId = [currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, listener.id].sort().join('_');
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour in seconds

  useEffect(() => {
    const loadLocal = async () => {
      const saved = await AsyncStorage.getItem(`chat_${chatId}`);
      if (saved) setMessages(JSON.parse(saved));
    };
    loadLocal();

    const unsubMessages = firestore().collection('chats').doc(chatId).collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(snapshot => {
        const cloudMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMessages(cloudMessages);
        AsyncStorage.setItem(`chat_${chatId}`, JSON.stringify(cloudMessages));
      }, error => Alert.alert('Error', 'Failed to load messages'));

    const checkStartTime = async () => {
      const chatDoc = await firestore().collection('activeChats').doc(chatId).get();
      if (chatDoc.exists) {
        const { startTime } = chatDoc.data();
        const elapsed = (new Date() - startTime.toDate()) / 1000;
        const remaining = Math.max(0, 3600 - elapsed);
        setTimeLeft(remaining);
      }
    };
    checkStartTime();

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          navigation.navigate('Rating', { targetId: listener.id, topic });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      unsubMessages();
    };
  }, [chatId, navigation]);

  const sendMessage = async () => {
    if (input.trim() === '') return;
    try {
      if (editingId) {
        await firestore().collection('chats').doc(chatId).collection('messages').doc(editingId)
          .update({ text: input, editedAt: firestore.FieldValue.serverTimestamp() });
        setEditingId(null);
      } else {
        await firestore().collection('chats').doc(chatId).collection('messages').add({
          text: input,
          isMine: true,
          sender: currentUser.type === 'email' ? currentUser.email : currentUser.deviceId,
          timestamp: firestore.FieldValue.serverTimestamp(),
          topic
        });
      }
      setInput('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const deleteMessage = async (id) => {
    await firestore().collection('chats').doc(chatId).collection('messages').doc(id).delete();
  };

  const editMessage = (id, oldText) => {
    setEditingId(id);
    setInput(oldText);
  };

  const reportUser = () => {
    Alert.alert(
      "Report User",
      "Why are you reporting this user?",
      [
        { text: "Vulgar Language", onPress: () => saveReport("Vulgar Language") },
        { text: "Asking Personal Questions", onPress: () => saveReport("Asking Personal Questions") },
        { text: "Using App as Dating App", onPress: () => saveReport("Using App as Dating App") },
        { text: "Cancel", style: "cancel" }
      ],
      { cancelable: true }
    );
  };

  const saveReport = async (reason) => {
    try {
      await firestore().collection("badUsers").add({
        userId: listener.id,
        reportedBy: currentUser.type === 'email' ? currentUser.email : currentUser.deviceId,
        reason,
        timestamp: firestore.FieldValue.serverTimestamp()
      });
      Alert.alert("Report Sent", "The user has been reported.");
    } catch (error) {
      Alert.alert("Error", "Could not send report.");
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#ccc", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "bold", textAlign: "center", flex: 1 }}>
            Chat with {listener.name} (Time Left: {formatTime(timeLeft)})
          </Text>
          <TouchableOpacity
            onPress={reportUser}
            style={{ backgroundColor: "rgba(255,0,0,0.3)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, marginLeft: 8 }}
          >
            <Text style={{ color: "red", fontSize: 12, fontWeight: "bold" }}>Report</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 10, flexGrow: 1, justifyContent: "flex-end" }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() =>
                item.isMine && Alert.alert("Message Options", "Choose an action", [
                  { text: "Edit", onPress: () => editMessage(item.id, item.text) },
                  { text: "Delete", onPress: () => deleteMessage(item.id), style: "destructive" },
                  { text: "Cancel", style: "cancel" }
                ])
              }
              style={{
                alignSelf: item.isMine ? "flex-end" : "flex-start",
                marginVertical: 4,
                padding: 8,
                backgroundColor: item.isMine ? "#007AFF" : "#E5E5EA",
                borderRadius: 6,
                maxWidth: "80%"
              }}
            >
              <Text style={{ fontSize: 16, color: item.isMine ? "#fff" : "#000", flexShrink: 1 }}>
                {item.text}
              </Text>
            </TouchableOpacity>
          )}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={styles.chatInputContainer}>
          <TextInput
            placeholder="Type your message"
            value={input}
            onChangeText={setInput}
            style={styles.chatInput}
          />
          <Button title={editingId ? "Update" : "Send"} onPress={sendMessage} />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function RatingScreen({ route, navigation }) {
  const { targetId, topic } = route.params;
  const [rating, setRating] = useState(0);

  const submit = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert('Please select a rating between 1 and 5');
      return;
    }
    await submitRating(targetId, rating);
    await removeActiveChat([currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, targetId].sort().join('_'));
    navigation.navigate('Topics');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Rate Your Experience</Text>
      <Text>Rate your conversation about {topic} (1-5 stars):</Text>
      <View style={{ flexDirection: 'row', marginVertical: 20 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <Text style={{ fontSize: 30, color: star <= rating ? '#ffd700' : '#ccc' }}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.chocoButton} onPress={submit}>
        <Text style={styles.chocoButtonText}>Submit Rating</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function PaymentScreen({ route, navigation }) {
  const { targetId, topic, isListener } = route.params;

  const subscribe = async () => {
    await setSubscribed(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
    Alert.alert('Subscribed successfully! You can now have unlimited chats for 1 week.');
    const chatId = [currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, targetId].sort().join('_');
    await addActiveChat(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, chatId, targetId, topic);
    if (isListener) {
      await addChatRequest(targetId, currentUser.type === 'email' ? currentUser.email : currentUser.deviceId, topic);
    }
    navigation.navigate('Chat', { listener: { id: targetId, name: isListener ? `${targetId} (Listener)` : targetId }, topic });
    await incrementSessionCount(currentUser.type === 'email' ? currentUser.email : currentUser.deviceId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Subscription Required</Text>
      <Text style={{ textAlign: 'center', marginVertical: 10 }}>
        Please pay just 99 PKR to help cover the app's operating expenses and it allows them to have as many chats as they want for a week.
      </Text>
      <Image
        source={require('./assets/ep.jpg')}
        style={{ width: 200, height: 200, marginVertical: 20 }}
      />
      <TouchableOpacity style={styles.chocoButton} onPress={subscribe}>
        <Text style={styles.chocoButtonText}>Confirm Payment</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function DetailsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>My Past Sessions 📜</Text>
      {sessionHistory.length === 0 ? (
        <Text>No sessions yet.</Text>
      ) : (
        <FlatList
          data={sessionHistory}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.sessionBox}>
              <Text style={{ fontWeight: 'bold' }}>{item.listener} ({item.topic})</Text>
              <Text>Last msg: {item.lastMessage}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function CommunityScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  const submitRequest = async () => {
    if (email && username) {
      await addJoiningRequest(email, username);
      Alert.alert('Request Submitted 🎉', 'Thanks! Please send us an Email or WhatsApp message with your basic information and life experiences so we can process your request.');
      setEmail('');
      setUsername('');
    } else {
      Alert.alert('Please enter both email and username');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Be Part of the Community 🌍</Text>
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginVertical: 10 }}>Step 1️⃣: Your Details</Text>
      <TextInput placeholder="Enter Username" value={username} onChangeText={setUsername} style={styles.input} />
      <TextInput placeholder="Enter Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
      <TouchableOpacity style={styles.topicButton} onPress={submitRequest}>
        <Text style={styles.topicText}>Submit Email</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginVertical: 20 }}>Step 2️⃣: Send More Info</Text>
      <TouchableOpacity style={styles.topicButton} onPress={() => Linking.openURL('mailto:24hourstired@gmail.com')}>
        <Text style={styles.topicText}>📧 Send us an Email</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.topicButton} onPress={() => Linking.openURL('https://wa.me/923424323203')}>
        <Text style={styles.topicText}>💬 Chat on WhatsApp</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MembersScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = async () => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
      const memberDoc = await firestore().collection('members').doc(email).get();
      if (memberDoc.exists) {
        const member = memberDoc.data();
        await firestore().collection('members').doc(email).update({ isOnline: true });
        currentMember = { email, role: member.role, isAdmin: email === ADMIN_EMAIL, isOnline: true };
        navigation.navigate('Dashboard');
      } else {
        Alert.alert('Invalid credentials or not approved');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Members Login 🌍</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />
      <TouchableOpacity style={styles.topicButton} onPress={login}>
        <Text style={styles.topicText}>Login</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MemberChatsScreen() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('chatRequests')
      .where('memberEmail', '==', currentMember.email)
      .onSnapshot(snapshot => {
        setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, error => Alert.alert('Error', 'Failed to load requests'));
    return unsub;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Chat Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text>{item.userId} - {item.topic}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function JoiningRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsub = firestore().collection('joiningRequests')
      .onSnapshot(snapshot => {
        setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, error => Alert.alert('Error', 'Failed to load requests'));
    return unsub;
  }, []);

  const approve = async (email, role) => {
    await approveJoiningRequest(email, role);
  };

  const reject = async (email) => {
    await rejectJoiningRequest(email);
  };

  const filtered = requests.filter((r) => (
    r.email?.toLowerCase().includes(search.toLowerCase()) ||
    r.username?.toLowerCase().includes(search.toLowerCase())
  ));

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Joining Requests</Text>
      <TextInput placeholder="Search email or username" value={search} onChangeText={setSearch} style={styles.input} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text style={{ fontWeight: 'bold' }}>{item.username}</Text>
            <Text>{item.email}</Text>
            <TouchableOpacity onPress={() => approve(item.email, 'Therapist')}>
              <Text>✅ Approve as Therapist</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => approve(item.email, 'Listener')}>
              <Text>✅ Approve as Listener</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => approve(item.email, 'Volunteer')}>
              <Text>✅ Approve as Volunteer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => reject(item.email)}>
              <Text style={{ color: 'red' }}>❌ Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function BadUsersScreen() {
  const [badUsers, setBadUsers] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('badUsers')
      .onSnapshot(snapshot => {
        setBadUsers(snapshot.docs.map(doc => doc.id));
      }, error => Alert.alert('Error', 'Failed to load bad users'));
    return unsub;
  }, []);

  const block = async (deviceIdOrEmail) => {
    await blockBadUser(deviceIdOrEmail);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Bad Users</Text>
      <FlatList
        data={badUsers}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text>{item}</Text>
            <TouchableOpacity onPress={() => block(item)}>
              <Text>Block</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function BadMembersScreen() {
  const [badMembers, setBadMembers] = useState([]);

  useEffect(() => {
    const unsub = firestore().collection('badMembers')
      .onSnapshot(snapshot => {
        setBadMembers(snapshot.docs.map(doc => doc.id));
      }, error => Alert.alert('Error', 'Failed to load bad members'));
    return unsub;
  }, []);

  const block = async (email) => {
    await blockBadMember(email);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Bad Members</Text>
      <FlatList
        data={badMembers}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text>{item}</Text>
            <TouchableOpacity onPress={() => block(item)}>
              <Text>Block</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function DashboardScreen() {
  return (
    <Tab.Navigator
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerTitle: currentMember.isAdmin ? 'Admin Dashboard' : 'Member Dashboard',
        headerRight: () => (
          currentMember.email ? (
            <TouchableOpacity onPress={() => logout(navigation)} style={{ marginRight: 12 }}>
              <Text style={{ color: '#dc3545', fontWeight: 'bold' }}>Logout</Text>
            </TouchableOpacity>
          ) : null
        ),
      })}
    >
      <Tab.Screen name="Chats" component={MemberChatsScreen} />
      {currentMember.isAdmin && <Tab.Screen name="Joining Requests" component={JoiningRequestsScreen} />}
      {currentMember.isAdmin && <Tab.Screen name="Bad Users" component={BadUsersScreen} />}
      {currentMember.isAdmin && <Tab.Screen name="Bad Members" component={BadMembersScreen} />}
    </Tab.Navigator>
  );
}

function HeaderMenu({ navigation }) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} style={{ paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 22 }}>⋮</Text>
      </TouchableOpacity>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setVisible(false)} />
        <View style={styles.menuSheet}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setVisible(false); navigation.navigate('Members'); }}>
            <Text>Members</Text>
          </TouchableOpacity>
          {currentUser?.type && (
            <TouchableOpacity style={styles.menuItem} onPress={() => { setVisible(false); logout(navigation); }}>
              <Text>Logout</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            headerRight: () => <HeaderMenu navigation={navigation} />,
          })}
        />
        <Stack.Screen name="Topics" component={TopicsScreen} />
        <Stack.Screen name="Listeners" component={ListenersScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
        <Stack.Screen name="Community" component={CommunityScreen} />
        <Stack.Screen name="Members" component={MembersScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="Rating" component={RatingScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  welcomeText: { fontSize: 18, color: '#ff69b4', marginBottom: 5, textAlign: 'center' },
  welcomeSubText: { fontSize: 16, color: '#666', marginBottom: 20, textAlign: 'center' },
  footer: { marginTop: 10, fontSize: 14, color: 'gray', textAlign: 'center' },
  input: { borderWidth: 1, padding: 8, marginVertical: 10, width: '80%', borderRadius: 8, borderColor: '#ccc' },
  topicButton: {
    padding: 12,
    backgroundColor: '#007bff',
    marginVertical: 8,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  listenerButton: { padding: 12, backgroundColor: '#28a745', marginVertical: 8, borderRadius: 8, width: '100%', alignItems: 'center' },
  topicText: { color: 'white', fontWeight: 'bold' },
  chatInputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  chatInput: { flex: 1, borderWidth: 1, padding: 8, marginRight: 8, borderRadius: 8 },
  sessionBox: { borderWidth: 1, borderColor: '#ddd', padding: 10, marginVertical: 5, borderRadius: 6, width: '100%' },
  cakeButton: {
    padding: 14,
    backgroundColor: '#ff9999',
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginVertical: 8,
  },
  cakeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  chocoButton: {
    padding: 12,
    backgroundColor: '#8b4513',
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginVertical: 8,
  },
  chocoButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  donutButton: {
    padding: 12,
    backgroundColor: '#9932cc',
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginVertical: 8,
  },
  donutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  giftBoxContainer: {
    width: '90%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffd700',
    borderRadius: 15,
    padding: 15,
    marginVertical: 10,
    backgroundColor: '#fff5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)' },
  menuSheet: { position: 'absolute', top: 60, right: 12, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 8, width: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
});
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* ✅ Header with Report button */}
        <View
          style={{
            padding: 12,
            borderBottomWidth: 1,
            borderColor: "#ccc",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "bold", textAlign: "center", flex: 1 }}>
            Chat with {listener.name}
          </Text>
          <TouchableOpacity
            onPress={reportUser}
            style={{
              backgroundColor: "rgba(255,0,0,0.3)", // translucent red
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 6,
              marginLeft: 8,
            }}
          >
            <Text style={{ color: "red", fontSize: 12, fontWeight: "bold" }}>Report</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ Messages list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 10, flexGrow: 1, justifyContent: "flex-end" }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() =>
                Alert.alert("Message Options", "Choose an action", [
                  { text: "Edit", onPress: () => editMessage(item.id, item.text) },
                  { text: "Delete", onPress: () => deleteMessage(item.id), style: "destructive" },
                  { text: "Cancel", style: "cancel" },
                ])
              }
              style={{
                alignSelf: item.isMine ? "flex-end" : "flex-start",
                marginVertical: 4,
                padding: 8,
                backgroundColor: item.isMine ? "#007AFF" : "#E5E5EA",
                borderRadius: 6,
                maxWidth: "80%",
              }}
            >
              <Text style={{ fontSize: 16, color: item.isMine ? "#fff" : "#000", flexShrink: 1 }}>
                {item.text}
              </Text>
            </TouchableOpacity>
          )}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* ✅ Chat input */}
        <View style={styles.chatInputContainer}>
          <TextInput
            placeholder="Type your message"
            value={input}
            onChangeText={setInput}
            style={styles.chatInput}
          />
          <Button title={editingId ? "Update" : "Send"} onPress={sendMessage} />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}






function DetailsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>My Past Sessions 📜</Text>
      {sessionHistory.length === 0 ? (
        <Text>No sessions yet.</Text>
      ) : (
        <FlatList
          data={sessionHistory}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.sessionBox}>
              <Text style={{ fontWeight: 'bold' }}>{item.listener} ({item.topic})</Text>
              <Text>Last msg: {item.lastMessage}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function CommunityScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');

  const submitRequest = async () => {
    if (email && username) {
      await addJoiningRequest(email, username);
      Alert.alert('Request Submitted 🎉', 'Thanks! Please send us an Email or WhatsApp message with your basic information and life experiences so we can process your request.');
      setEmail('');
      setUsername('');
    } else {
      Alert.alert('Please enter both email and username');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Be Part of the Community 🌍</Text>
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginVertical: 10 }}>Step 1️⃣: Your Details</Text>
      <TextInput placeholder="Enter Username" value={username} onChangeText={setUsername} style={styles.input} />
      <TextInput placeholder="Enter Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
      <TouchableOpacity style={styles.topicButton} onPress={submitRequest}>
        <Text style={styles.topicText}>Submit Email</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginVertical: 20 }}>Step 2️⃣: Send More Info</Text>
      <TouchableOpacity style={styles.topicButton} onPress={() => Linking.openURL('mailto:24hourstired@gmail.com')}>
        <Text style={styles.topicText}>📧 Send us an Email</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.topicButton} onPress={() => Linking.openURL('https://wa.me/923424323203')}>
        <Text style={styles.topicText}>💬 Chat on WhatsApp</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MembersScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = async () => {
    // Admin
    if (email === ADMIN_EMAIL && password === '766322Ali*') {
      let members = await getMembers();
      const idx = members.findIndex((m) => m.email === ADMIN_EMAIL);
      if (idx !== -1) {
        members[idx].isOnline = true;
      } else {
        members.push({ email: ADMIN_EMAIL, role: 'Admin', isOnline: true });
      }
      await AsyncStorage.setItem('members', JSON.stringify(members));
      currentMember = { email: ADMIN_EMAIL, role: 'Admin', isAdmin: true, isOnline: true };
      navigation.navigate('Dashboard');
      return;
    }

    // Normal members
    let members = await getMembers();
    const memberIndex = members.findIndex((m) => m.email === email);
    if (memberIndex !== -1) {
      members[memberIndex].isOnline = true;
      await AsyncStorage.setItem('members', JSON.stringify(members));
      const member = members[memberIndex];
      currentMember = { ...member, isAdmin: false, isOnline: true };
      navigation.navigate('Dashboard');
    } else {
      Alert.alert('Invalid credentials or not approved');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Members Login 🌍</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />
      <TouchableOpacity style={styles.topicButton} onPress={login}>
        <Text style={styles.topicText}>Login</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MemberChatsScreen() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const load = async () => {
      const reqs = await getChatRequests(currentMember.email);
      setRequests(reqs);
    };
    const unsub = () => {};
    load();
    return unsub;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Chat Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text>{item.userEmail} - {item.topic}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function JoiningRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const reqs = await getJoiningRequests();
      setRequests(reqs);
    };
    const unsubscribe = () => {};
    load();
    return unsubscribe;
  }, []);

  const approve = async (email, role) => {
    await approveJoiningRequest(email, role);
    setRequests((prev) => prev.filter((r) => r.email !== email));
  };

  const reject = async (email) => {
    await rejectJoiningRequest(email);
    setRequests((prev) => prev.filter((r) => r.email !== email));
  };

  const filtered = requests.filter((r) => (r.email?.toLowerCase().includes(search.toLowerCase()) || r.username?.toLowerCase().includes(search.toLowerCase())));

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Joining Requests</Text>
      <TextInput placeholder="Search email or username" value={search} onChangeText={setSearch} style={styles.input} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.email}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text style={{ fontWeight: 'bold' }}>{item.username}</Text>
            <Text>{item.email}</Text>
            <TouchableOpacity onPress={() => approve(item.email, 'Therapist')}>
              <Text>✅ Approve as Therapist</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => approve(item.email, 'Listener')}>
              <Text>✅ Approve as Listener</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => approve(item.email, 'Volunteer')}>
              <Text>✅ Approve as Volunteer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => reject(item.email)}>
              <Text style={{ color: 'red' }}>❌ Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function BadUsersScreen() {
  const [badUsers, setBadUsers] = useState([]);

  useEffect(() => {
    const load = async () => {
      const bad = await getBadUsers();
      setBadUsers(bad);
    };
    load();
  }, []);

  const block = async (email) => {
    await blockBadUser(email);
    setBadUsers((prev) => prev.filter((b) => b !== email));
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Bad Users</Text>
      <FlatList
        data={badUsers}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text>{item}</Text>
            <TouchableOpacity onPress={() => block(item)}>
              <Text>Block</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function BadMembersScreen() {
  const [badMembers, setBadMembers] = useState([]);

  useEffect(() => {
    const load = async () => {
      const bad = await getBadMembers();
      setBadMembers(bad);
    };
    load();
  }, []);

  const block = async (email) => {
    await blockBadMember(email);
    setBadMembers((prev) => prev.filter((b) => b !== email));
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Bad Members</Text>
      <FlatList
        data={badMembers}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.sessionBox}>
            <Text>{item}</Text>
            <TouchableOpacity onPress={() => block(item)}>
              <Text>Block</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function SubscribeScreen({ route, navigation }) {
  const { email } = route.params;

  const subscribe = async () => {
    await setSubscribed(email);
    Alert.alert('Subscribed successfully!');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Subscribe to Continue</Text>
      <Text>Please subscribe for more sessions.</Text>
      <TouchableOpacity style={styles.chocoButton} onPress={subscribe}>
        <Text style={styles.chocoButtonText}>Subscribe Now</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/* -------------------------
   Header Menu (three dots)
   ------------------------- */
function HeaderMenu({ navigation }) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} style={{ paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 22 }}>⋮</Text>
      </TouchableOpacity>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setVisible(false)} />
        <View style={styles.menuSheet}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setVisible(false); navigation.navigate('Members'); }}>
            <Text>Members</Text>
          </TouchableOpacity>
          {currentUser?.type && (
            <TouchableOpacity style={styles.menuItem} onPress={() => { setVisible(false); logout(navigation); }}>
              <Text>Logout</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* -------------------------
   App Navigator
   ------------------------- */

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={({ navigation }) => ({
            headerRight: () => <HeaderMenu navigation={navigation} />,
          })}
        />
        <Stack.Screen name="Topics" component={TopicsScreen} />
        <Stack.Screen name="Listeners" component={ListenersScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
        <Stack.Screen name="Community" component={CommunityScreen} />
        <Stack.Screen name="Members" component={MembersScreen} />
        <Stack.Screen name="Subscribe" component={SubscribeScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/* -------------------------
   Member Dashboard (tabs)
   ------------------------- */
function DashboardScreen() {
  return (
    <Tab.Navigator
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerTitle: currentMember.isAdmin ? 'Admin Dashboard' : 'Member Dashboard',
        headerRight: () => (
          currentMember.email ? (
            <TouchableOpacity onPress={() => logout(navigation)} style={{ marginRight: 12 }}>
              <Text style={{ color: '#dc3545', fontWeight: 'bold' }}>Logout</Text>
            </TouchableOpacity>
          ) : null
        ),
      })}
    >
      <Tab.Screen name="Chats" component={MemberChatsScreen} />
      {currentMember.isAdmin && <Tab.Screen name="Joining Requests" component={JoiningRequestsScreen} />}
      {currentMember.isAdmin && <Tab.Screen name="Bad Users" component={BadUsersScreen} />}
      {currentMember.isAdmin && <Tab.Screen name="Bad Members" component={BadMembersScreen} />}
    </Tab.Navigator>
  );
}

/* -------------------------
   Styles
   ------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  welcomeText: { fontSize: 18, color: '#ff69b4', marginBottom: 5, textAlign: 'center' },
  welcomeSubText: { fontSize: 16, color: '#666', marginBottom: 20, textAlign: 'center' },
  footer: { marginTop: 10, fontSize: 14, color: 'gray', textAlign: 'center' },
  input: { borderWidth: 1, padding: 8, marginVertical: 10, width: '80%', borderRadius: 8, borderColor: '#ccc' },
  topicButton: { 
    padding: 12, 
    backgroundColor: '#007bff', 
    marginVertical: 8, 
    borderRadius: 8, 
    width: '80%', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  listenerButton: { padding: 12, backgroundColor: '#28a745', marginVertical: 8, borderRadius: 8, width: '100%', alignItems: 'center' },
  topicText: { color: 'white', fontWeight: 'bold' },
  chatInputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  chatInput: { flex: 1, borderWidth: 1, padding: 8, marginRight: 8, borderRadius: 8 },
  message: { padding: 6, backgroundColor: '#f1f1f1', marginVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  sessionBox: { borderWidth: 1, borderColor: '#ddd', padding: 10, marginVertical: 5, borderRadius: 6, width: '100%' },
  cakeButton: {
    padding: 14,
    backgroundColor: '#ff9999',
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginVertical: 8,
  },
  cakeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  chocoButton: {
    padding: 12,
    backgroundColor: '#8b4513',
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginVertical: 8,
  },
  chocoButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  donutButton: {
    padding: 12,
    backgroundColor: '#9932cc',
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginVertical: 8,
  },
  donutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  giftBoxContainer: {
    width: '90%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffd700',
    borderRadius: 15,
    padding: 15,
    marginVertical: 10,
    backgroundColor: '#fff5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
 chatBubble: {
  padding: 10,
  marginVertical: 4,
  borderRadius: 8,
  maxWidth: "80%",
},

myBubble: {
  backgroundColor: "#007AFF",   // iMessage-style blue
  alignSelf: "flex-end",
},

theirBubble: {
  backgroundColor: "#E5E5EA",   // light gray
  alignSelf: "flex-start",
},

messageText: {
  fontSize: 16,
  color: "#000",
  flexShrink: 1,
  flexWrap: "wrap",
},


chatInputContainer: {
  flexDirection: "row",
  alignItems: "center",
  padding: 10,
  borderTopWidth: 1,
  borderColor: "#ccc",
},
chatInput: {
  flex: 1,
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 20,
  paddingHorizontal: 12,
  marginRight: 8,
},



  giftBoxRibbon: { fontSize: 20, color: '#ff4040', marginVertical: 5 },
  /* menu */
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)' },
  menuSheet: { position: 'absolute', top: 60, right: 12, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 8, width: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
 
});

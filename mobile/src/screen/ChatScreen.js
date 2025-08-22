import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';

const API_BASE_URL = 'http://localhost:3001';

const ChatScreen = ({ route, navigation }) => {
  const { user: recipient } = route.params;
  const { user: currentUser } = useAuth();
  const socket = useSocket();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  
  const flatListRef = useRef();

  useEffect(() => {
    navigation.setOptions({
      title: recipient.username
    });

    loadMessages();

    // Socket event listeners
    if (socket) {
      socket.on('message:new', handleNewMessage);
      socket.on('typing:start', handleTypingStart);
      socket.on('typing:stop', handleTypingStop);
      socket.on('message:read', handleMessageRead);
    }

    return () => {
      if (socket) {
        socket.off('message:new', handleNewMessage);
        socket.off('typing:start', handleTypingStart);
        socket.off('typing:stop', handleTypingStop);
        socket.off('message:read', handleMessageRead);
      }
    };
  }, [socket, recipient]);

  const loadMessages = async (pageNum = 1) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await axios.get(
        `${API_BASE_URL}/messages/conversations/${recipient._id}/messages?page=${pageNum}&limit=20`
      );

      if (pageNum === 1) {
        setMessages(response.data);
      } else {
        setMessages(prev => [...response.data, ...prev]);
      }

      setPage(pageNum);
      setHasMore(response.data.length === 20);
      
      // Mark messages as read
      if (socket && pageNum === 1) {
        socket.emit('message:read', { senderId: recipient._id });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleNewMessage = (message) => {
    if (message.sender._id === recipient._id || message.sender._id === currentUser._id) {
      setMessages(prev => [...prev, message]);
      
      // Mark as read if message is from recipient
      if (message.sender._id === recipient._id && socket) {
        socket.emit('message:read', { senderId: recipient._id });
      }
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleTypingStart = (data) => {
    if (data.senderId === recipient._id) {
      setIsTyping(true);
    }
  };

  const handleTypingStop = (data) => {
    if (data.senderId === recipient._id) {
      setIsTyping(false);
    }
  };

  const handleMessageRead = (data) => {
    if (data.readerId === recipient._id) {
      setMessages(prev => prev.map(msg => 
        msg.sender._id === currentUser._id && !msg.isRead 
          ? { ...msg, isRead: true } 
          : msg
      ));
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() && socket) {
      socket.emit('message:send', {
        receiverId: recipient._id,
        content: newMessage.trim()
      });
      setNewMessage('');
    }
  };

  const handleInputChange = (text) => {
    setNewMessage(text);
    
    if (socket) {
      // Emit typing start
      socket.emit('typing:start', { receiverId: recipient._id });
      
      // Clear previous timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      // Set new timeout to stop typing
      const timeout = setTimeout(() => {
        socket.emit('typing:stop', { receiverId: recipient._id });
      }, 1000);
      
      setTypingTimeout(timeout);
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender._id === currentUser._id;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble
        ]}>
          <Text style={styles.messageText}>{item.content}</Text>
          <View style={styles.messageMeta}>
            <Text style={styles.messageTime}>
              {new Date(item.createdAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            {isMyMessage && (
              <Icon 
                name={item.isRead ? 'done-all' : 'done'} 
                size={16} 
                color={item.isRead ? '#007AFF' : '#999'} 
                style={styles.readIcon} 
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.messagesList}
        onEndReached={() => hasMore && loadMessages(page + 1)}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.loader} color="#007AFF" /> : null
        }
        inverted={false}
      />
      
      {isTyping && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>{recipient.username} is typing...</Text>
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={handleInputChange}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={handleSendMessage}
          disabled={!newMessage.trim()}
        >
          <Icon name="send" size={24} color={newMessage.trim() ? "#007AFF" : "#ccc"} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  messagesList: {
    padding: 10
  },
  messageContainer: {
    marginVertical: 5
  },
  myMessageContainer: {
    alignItems: 'flex-end'
  },
  theirMessageContainer: {
    alignItems: 'flex-start'
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 5
  },
  myMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 5
  },
  theirMessageBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: '#eee'
  },
  messageText: {
    fontSize: 16,
    color: 'black'
  },
  myMessageText: {
    color: 'white'
  },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 5
  },
  messageTime: {
    fontSize: 12,
    color: '#666'
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)'
  },
  readIcon: {
    marginLeft: 5
  },
  typingIndicator: {
    padding: 10,
    alignItems: 'center'
  },
  typingText: {
    color: '#666',
    fontStyle: 'italic'
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'flex-end',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 10
  },
  sendButton: {
    padding: 10
  },
  loader: {
    marginVertical: 10
  }
});

export default ChatScreen;
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';

const API_BASE_URL = 'http://localhost:3001';

const HomeScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, logout } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout, style: 'destructive' }
      ]
    );
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => navigation.navigate('Chat', { user: item })}
    >
      <View style={styles.userInfo}>
        <View style={[styles.statusIndicator, { backgroundColor: item.isOnline ? '#4CAF50' : '#9E9E9E' }]} />
        <Text style={styles.username}>{item.username}</Text>
      </View>
      
      {item.lastMessage && (
        <View style={styles.lastMessageContainer}>
          <Text 
            style={[
              styles.lastMessage,
              item.lastMessage.isSentByMe && styles.lastMessageSent
            ]}
            numberOfLines={1}
          >
            {item.lastMessage.isSentByMe ? 'You: ' : ''}{item.lastMessage.content}
          </Text>
          <Text style={styles.lastMessageTime}>
            {formatTime(item.lastMessage.createdAt)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Icon name="logout" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={users}
        renderItem={renderUserItem}
        keyExtractor={item => item._id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  listContent: {
    padding: 10
  },
  userItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  lastMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  lastMessage: {
    flex: 1,
    color: '#666',
    fontSize: 14
  },
  lastMessageSent: {
    color: '#999'
  },
  lastMessageTime: {
    color: '#999',
    fontSize: 12,
    marginLeft: 10
  }
});

export default HomeScreen;
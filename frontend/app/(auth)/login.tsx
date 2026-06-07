import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { COLORS, SPACING } from '@/src/constants/theme';
import CosmicAuthBackground from '@/src/components/CosmicAuthBackground';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    // Clear previous error
    setErrorMessage('');
    
    if (!identifier.trim()) {
      setErrorMessage('Please enter your email or username');
      return;
    }
    
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login(identifier.trim(), password);
    } catch (error: any) {
      console.log('Login error:', error);
      const detail = error.response?.data?.detail;
      
      // Provide more helpful error messages
      if (error.response?.status === 401) {
        setErrorMessage('Incorrect email/username or password. Please try again.');
      } else if (error.response?.status === 422) {
        setErrorMessage('Invalid input. Please check your email and password format.');
      } else if (detail) {
        setErrorMessage(detail);
      } else if (error.message?.includes('Network')) {
        setErrorMessage('Network error. Please check your connection.');
      } else {
        setErrorMessage('Login failed. Please try again.');
      }
      
      // Also show alert for mobile users
      if (Platform.OS !== 'web') {
        Alert.alert('Login Failed', detail || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <CosmicAuthBackground />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoGlow}>
            <Image
              source={require('@/assets/brand/logo.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
          </View>
          <Text style={styles.title}>GenC Vibez</Text>
          <Text style={styles.subtitle}>Connect • Chat • Vibe</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.form}>
          {/* Error Message Display */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={COLORS.error} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <Ionicons name="person-circle-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email or Username"
              placeholderTextColor={COLORS.textSecondary}
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                if (errorMessage) setErrorMessage('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              testID="login-identifier-input"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textSecondary}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage('');
              }}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </Link>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0820',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoGlow: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    // @ts-ignore RN web shadow
    boxShadow: '0 0 60px rgba(192,132,252,0.55), 0 0 120px rgba(236,72,153,0.35)',
    shadowColor: '#c084fc',
    shadowOpacity: 0.7,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  logoImage: {
    width: 128,
    height: 128,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: 0.3,
    // @ts-ignore
    textShadow: '0 2px 18px rgba(192,132,252,0.65)',
  },
  subtitle: {
    fontSize: 14,
    color: '#cbb6ff',
    opacity: 0.9,
    letterSpacing: 0.6,
  },
  formCard: {
    backgroundColor: 'rgba(20, 14, 42, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.28)',
    borderRadius: 22,
    padding: SPACING.md,
    // @ts-ignore RN web backdrop blur
    backdropFilter: 'blur(18px)',
    // @ts-ignore web shadow
    boxShadow: '0 18px 60px rgba(124, 58, 237, 0.35), 0 4px 16px rgba(0,0,0,0.45)',
  },
  form: {
    width: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.22)',
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    paddingVertical: SPACING.md,
    // @ts-ignore web
    outlineStyle: 'none',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
    // @ts-ignore
    boxShadow: '0 10px 24px rgba(124,58,237,0.55)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  forgotPasswordText: {
    color: '#f0abfc',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    color: '#cbb6ff',
    opacity: 0.85,
    fontSize: 14,
  },
  link: {
    color: '#f0abfc',
    fontSize: 14,
    fontWeight: '700',
  },
});
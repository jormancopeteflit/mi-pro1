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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';

type Props = {
  navigation?: any;
};

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { login, isLoading } = useAuthStore();

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      await login({ email: email.trim().toLowerCase(), password });
      // Root navigator reacts to auth state change automatically
    } catch (e: any) {
      if (e.code === 'INVALID_CREDENTIALS') {
        Alert.alert('Login failed', 'Email or password is incorrect.');
      } else {
        Alert.alert('Login failed', e.message || 'Please try again.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {/* Email */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, fieldErrors.email ? styles.inputError : null]}
            placeholder="jane@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={(t) => { setEmail(t); setFieldErrors((e) => ({ ...e, email: '' })); }}
            testID="login-email-input"
          />
          {fieldErrors.email ? <Text style={styles.errorText}>{fieldErrors.email}</Text> : null}
        </View>

        {/* Password */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, fieldErrors.password ? styles.inputError : null]}
            placeholder="Your password"
            secureTextEntry
            value={password}
            onChangeText={(t) => { setPassword(t); setFieldErrors((e) => ({ ...e, password: '' })); }}
            testID="login-password-input"
          />
          {fieldErrors.password ? (
            <Text style={styles.errorText}>{fieldErrors.password}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
          testID="login-submit-button"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log in</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation?.navigate('Register')} testID="go-to-register">
            <Text style={styles.link}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 32 },
  fieldContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
    color: '#111',
  },
  inputError: { borderColor: '#e03e3e' },
  errorText: { color: '#e03e3e', fontSize: 12, marginTop: 4 },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#666', fontSize: 14 },
  link: { color: '#4F46E5', fontSize: 14, fontWeight: '600' },
});

export default LoginScreen;

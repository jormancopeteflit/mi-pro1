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
  /** navigation prop – compatible with React Navigation */
  navigation?: any;
};

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { register, isLoading } = useAuthStore();

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    try {
      await register({ name: name.trim(), email: email.trim().toLowerCase(), password });
      // On success, navigation to main app is handled by the root navigator
    } catch (e: any) {
      if (e.code === 'EMAIL_ALREADY_REGISTERED') {
        Alert.alert('Registration failed', 'This email is already in use. Please log in.');
      } else {
        Alert.alert('Registration failed', e.message || 'Please try again.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up to get started</Text>

        {/* Name */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, fieldErrors.name ? styles.inputError : null]}
            placeholder="Jane Doe"
            autoCapitalize="words"
            autoCorrect={false}
            value={name}
            onChangeText={setName}
            testID="register-name-input"
          />
          {fieldErrors.name ? <Text style={styles.errorText}>{fieldErrors.name}</Text> : null}
        </View>

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
            onChangeText={setEmail}
            testID="register-email-input"
          />
          {fieldErrors.email ? <Text style={styles.errorText}>{fieldErrors.email}</Text> : null}
        </View>

        {/* Password */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, fieldErrors.password ? styles.inputError : null]}
            placeholder="Min 8 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            testID="register-password-input"
          />
          {fieldErrors.password ? <Text style={styles.errorText}>{fieldErrors.password}</Text> : null}
        </View>

        {/* Confirm Password */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={[styles.input, fieldErrors.confirmPassword ? styles.inputError : null]}
            placeholder="Repeat password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            testID="register-confirm-password-input"
          />
          {fieldErrors.confirmPassword ? (
            <Text style={styles.errorText}>{fieldErrors.confirmPassword}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
          testID="register-submit-button"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Register</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation?.navigate('Login')} testID="go-to-login">
            <Text style={styles.link}>Log in</Text>
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

export default RegisterScreen;

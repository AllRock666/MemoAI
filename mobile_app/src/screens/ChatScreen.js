/**
 * ChatScreen — main patient-facing chat interface
 * Features:
 *   - Text chat with Groq 70B RAG replies
 *   - Hold-to-record voice input (Groq Whisper STT)
 *   - Caregiver feedback (thumbs up/down) per response
 *   - Confusion detection indicator
 *   - Multilingual: EN / HI / MR
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StyleSheet, Animated, Vibration,
} from 'react-native';
import { Audio } from 'expo-av';
import { sendChat, sendVoice, submitFeedback, getPatientId } from '../services/api';
import { colors, fonts, spacing, radii } from '../utils/theme';
import useTranslation from '../utils/useTranslation';

// ── Mic Button ────────────────────────────────────────────────────────────────

function MicButton({ onVoiceReply, onTranscript, disabled }) {
  const [recording, setRecording] = useState(null);
  const [busy, setBusy]           = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef(null);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    if (pulseLoop.current) pulseLoop.current.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      Vibration.vibrate(40);
      startPulse();
      Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true }).start();
    } catch (e) {
      console.error('Record start error:', e);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    stopPulse();
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    setBusy(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      const pid  = getPatientId();
      const data = await sendVoice(pid, uri);
      if (data.transcript) onTranscript(data.transcript, data.turn_id);
      if (data.reply)      onVoiceReply(data.reply, data.transcript, data.turn_id);
    } catch (e) {
      console.error('Voice send error:', e);
      onVoiceReply("Sorry, I had trouble hearing that. Could you try again?", '', null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.micWrap}>
      <Animated.View style={[styles.micPulse, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.micBtn, recording && styles.micBtnActive]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          disabled={busy || disabled}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.micIcon}>{recording ? '⏹' : '🎙'}</Text>
          }
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Chat Bubble ───────────────────────────────────────────────────────────────

function ChatBubble({ item, onFeedback }) {
  const isUser    = item.role === 'user';
  const [feedback, setFeedback] = useState(null);  // null | 'up' | 'down'

  const handleFeedback = async (helpful) => {
    const fb = helpful ? 'up' : 'down';
    setFeedback(fb);
    if (item.turnId) {
      try {
        await submitFeedback('current', item.turnId, helpful);
      } catch (e) {
        console.warn('Feedback error:', e);
      }
    }
  };

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>M</Text>
        </View>
      )}
      <View style={styles.bubbleContainer}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleTxt, isUser ? styles.bubbleTxtUser : styles.bubbleTxtAI]}>
            {item.text}
          </Text>
          {item.voiceOf ? (
            <Text style={styles.transcriptTag}>🎙 "{item.voiceOf}"</Text>
          ) : null}
          {item.confusion && (
            <Text style={styles.confusionTag}>⚠️ Confusion detected</Text>
          )}
        </View>

        {/* Caregiver feedback buttons — only on AI messages */}
        {!isUser && !feedback && (
          <View style={styles.feedbackRow}>
            <TouchableOpacity style={styles.feedbackBtn} onPress={() => handleFeedback(true)}>
              <Text style={styles.feedbackIcon}>👍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.feedbackBtn} onPress={() => handleFeedback(false)}>
              <Text style={styles.feedbackIcon}>👎</Text>
            </TouchableOpacity>
          </View>
        )}
        {!isUser && feedback && (
          <Text style={styles.feedbackGiven}>
            {feedback === 'up' ? '✅ Marked helpful' : '❌ Marked unhelpful'}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    setMessages([{ id: '0', role: 'ai', text: t('chatGreeting'), turnId: null }]);
  }, [t('chatGreeting')]);

  const addMessage = useCallback((role, text, extra = {}) => {
    const msg = { id: Date.now().toString() + Math.random(), role, text, ...extra };
    setMessages(prev => [...prev, msg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return msg;
  }, []);

  const sendText = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addMessage('user', text);
    setLoading(true);
    try {
      const data = await sendChat(getPatientId(), text);
      addMessage('ai', data.reply, { turnId: data.turn_id });
    } catch {
      addMessage('ai', t('chatError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <ChatBubble item={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {loading && (
        <View style={styles.typingRow}>
          <View style={styles.avatar}><Text style={styles.avatarTxt}>M</Text></View>
          <View style={styles.typingBubble}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.typingTxt}> {t('chatThinking')}</Text>
          </View>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t('chatPlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          onSubmitEditing={sendText}
          returnKeyType="send"
          blurOnSubmit
        />
        <MicButton
          onVoiceReply={(reply, transcript, turnId) =>
            addMessage('ai', reply, { voiceOf: transcript, turnId })
          }
          onTranscript={(tx) => addMessage('user', tx)}
          disabled={loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendText}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list:      { padding: spacing.md, paddingBottom: spacing.xl },

  bubbleRow:     { flexDirection: 'row', marginBottom: spacing.md, alignItems: 'flex-end' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI:   { justifyContent: 'flex-start' },

  avatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  avatarTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },

  bubbleContainer: { maxWidth: '78%' },
  bubble:          { borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleUser:      { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleAI:        { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },

  bubbleTxt:     { fontSize: 16, lineHeight: 23 },
  bubbleTxtUser: { color: '#fff', fontFamily: fonts.body },
  bubbleTxtAI:   { color: colors.text, fontFamily: fonts.body },

  transcriptTag: { marginTop: 4, fontSize: 11, color: colors.textMuted, fontFamily: fonts.body, fontStyle: 'italic' },
  confusionTag:  { marginTop: 4, fontSize: 11, color: colors.warm, fontFamily: fonts.body },

  feedbackRow:  { flexDirection: 'row', marginTop: 4, gap: spacing.xs },
  feedbackBtn:  { padding: 4 },
  feedbackIcon: { fontSize: 16 },
  feedbackGiven:{ fontSize: 11, color: colors.textMuted, fontFamily: fonts.body, marginTop: 4 },

  typingRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: 4 },
  typingBubble:{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  typingTxt:   { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.sm, paddingBottom: spacing.md, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontFamily: fonts.body, fontSize: 15, maxHeight: 100 },

  sendBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  sendBtnDisabled:{ opacity: 0.4 },
  sendIcon:       { color: '#fff', fontSize: 16 },

  micWrap:      { position: 'relative', alignItems: 'center', justifyContent: 'center', marginLeft: spacing.xs },
  micPulse:     { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentLight, opacity: 0.35 },
  micBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.warm, alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: '#e05a5a' },
  micIcon:      { fontSize: 20 },
});

/**
 * MemoryScreen — browse past memories + upload photo
 * Photos → Groq LLaVA → description + people extraction → ChromaDB
 * Multilingual: EN / HI / MR
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, TextInput, Alert, Image, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { getMemories, uploadPhoto, getPatientId } from '../services/api';
import { colors, fonts, spacing, radii } from '../utils/theme';
import useTranslation from '../utils/useTranslation';

const MEMORY_ICONS = ['💭', '📸', '🌸', '⭐', '🏡', '🎂', '🌺', '📖'];

function MemoryItem({ text, index }) {
  return (
    <View style={styles.memItem}>
      <Text style={styles.memIcon}>{MEMORY_ICONS[index % MEMORY_ICONS.length]}</Text>
      <Text style={styles.memText}>{text}</Text>
    </View>
  );
}

function PhotoUploadModal({ visible, onClose, onSuccess }) {
  const { t }       = useTranslation();
  const [imageUri,  setImageUri]  = useState(null);
  const [note,      setNote]      = useState('');
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo access.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, allowsEditing: true,
    });
    if (!res.canceled && res.assets?.[0]) { setImageUri(res.assets[0].uri); setResult(null); }
  };

  const takePicture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow camera access.'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) { setImageUri(res.assets[0].uri); setResult(null); }
  };

  const doUpload = async () => {
    if (!imageUri) return;
    setUploading(true);
    try {
      const data = await uploadPhoto(getPatientId(), imageUri, note);
      setResult(data);
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (result) onSuccess();
    setImageUri(null); setNote(''); setResult(null);
    onClose();
  };

  const peopleCount = result?.people_found?.length ?? 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('memModalTitle')}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {!result ? (
            <>
              {imageUri
                ? <Image source={{ uri: imageUri }} style={styles.preview} />
                : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderIcon}>📷</Text>
                    <Text style={styles.photoPlaceholderTxt}>No photo selected</Text>
                  </View>
                )
              }

              <View style={styles.pickerBtns}>
                <TouchableOpacity style={styles.pickerBtn} onPress={pickImage}>
                  <Text style={styles.pickerBtnTxt}>{t('memGallery')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerBtn} onPress={takePicture}>
                  <Text style={styles.pickerBtnTxt}>{t('memCamera')}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>{t('memCaregiverNote')}</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder={t('memNotePlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <TouchableOpacity
                style={[styles.uploadBtn, (!imageUri || uploading) && styles.uploadBtnDisabled]}
                onPress={doUpload}
                disabled={!imageUri || uploading}
              >
                {uploading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.uploadBtnTxt}>{t('memAnalyse')}</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.resultBox}>
              <Text style={styles.resultIcon}>✅</Text>
              <Text style={styles.resultTitle}>{t('memSaved')}</Text>
              <Text style={styles.resultDesc}>{result.description}</Text>
              {peopleCount > 0 && (
                <View style={styles.peopleFound}>
                  <Text style={styles.peopleFoundTitle}>
                    👥 {peopleCount} {peopleCount > 1 ? t('memPeopleFound') : t('memPerson')}
                  </Text>
                  {result.people_found.map((p, i) => (
                    <Text key={i} style={styles.personFoundName}>
                      • {p.name} ({p.relation})
                    </Text>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.uploadBtn} onPress={handleClose}>
                <Text style={styles.uploadBtnTxt}>{t('memDone')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MemoryScreen() {
  const { t } = useTranslation();
  const [memories,   setMemories]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [query,      setQuery]      = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async (q = 'recent') => {
    setLoading(true);
    try {
      const data = await getMemories(getPatientId(), q);
      setMemories(data.memories || []);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('memSearchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={() => load(query || 'recent')}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => load(query || 'recent')}>
          <Text style={styles.searchBtnTxt}>🔍</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTxt}>{t('memFetching')}</Text>
        </View>
      ) : memories.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🌸</Text>
          <Text style={styles.emptyTitle}>{t('memEmpty')}</Text>
          <Text style={styles.emptyBody}>{t('memEmptyBody')}</Text>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item, index }) => <MemoryItem text={item} index={index} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowUpload(true)}>
        <Text style={styles.fabTxt}>📸</Text>
      </TouchableOpacity>

      <PhotoUploadModal
        visible={showUpload}
        onClose={() => setShowUpload(false)}
        onSuccess={() => load()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  topBar:       { flexDirection: 'row', padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput:  { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontFamily: fonts.body, fontSize: 15 },
  searchBtn:    { width: 44, height: 44, backgroundColor: colors.accent, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  searchBtnTxt: { fontSize: 20 },

  list:    { padding: spacing.md },
  memItem: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  memIcon: { fontSize: 22, marginRight: spacing.sm, marginTop: 1 },
  memText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },

  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingTxt: { marginTop: spacing.sm, color: colors.textMuted, fontFamily: fonts.body },
  emptyIcon:  { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, marginBottom: spacing.sm },
  emptyBody:  { textAlign: 'center', color: colors.textMuted, fontFamily: fonts.body, lineHeight: 22 },

  fab:    { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.warm, alignItems: 'center', justifyContent: 'center', shadowColor: colors.warm, shadowOpacity: 0.45, shadowRadius: 10, elevation: 6 },
  fabTxt: { fontSize: 24 },

  modal:       { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle:  { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  modalClose:  { fontSize: 20, color: colors.textMuted, padding: 4 },

  preview:             { width: '100%', height: 220, borderRadius: radii.lg, marginBottom: spacing.md },
  photoPlaceholder:    { width: '100%', height: 180, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  photoPlaceholderIcon:{ fontSize: 40, marginBottom: 8 },
  photoPlaceholderTxt: { color: colors.textMuted, fontFamily: fonts.body },

  pickerBtns:   { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  pickerBtn:    { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, alignItems: 'center' },
  pickerBtnTxt: { fontFamily: fonts.body, fontSize: 15, color: colors.text },

  fieldLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginBottom: 6 },
  noteInput:  { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.text, fontFamily: fonts.body, fontSize: 15, minHeight: 80, marginBottom: spacing.md, textAlignVertical: 'top' },

  uploadBtn:        { backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.md, alignItems: 'center' },
  uploadBtnDisabled:{ opacity: 0.4 },
  uploadBtnTxt:     { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },

  resultBox:       { alignItems: 'center', padding: spacing.md },
  resultIcon:      { fontSize: 52, marginBottom: spacing.sm },
  resultTitle:     { fontFamily: fonts.bold, fontSize: 22, color: colors.text, marginBottom: spacing.md },
  resultDesc:      { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: spacing.md },
  peopleFound:     { width: '100%', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  peopleFoundTitle:{ fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginBottom: 6 },
  personFoundName: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginBottom: 2 },
});

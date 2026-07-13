/**
 * PeopleScreen — shows all people known to the patient
 * Fetched from ChromaDB via /people/:id
 * Multilingual: EN / HI / MR
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  StyleSheet, RefreshControl, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPeople, getPatientId } from '../services/api';
import { colors, fonts, spacing, radii } from '../utils/theme';
import useTranslation from '../utils/useTranslation';

const RELATION_COLORS = {
  son:           '#4A90D9',
  daughter:      '#D94A90',
  wife:          '#D94A4A',
  husband:       '#4A4AD9',
  grandson:      '#4AD97A',
  granddaughter: '#D9CA4A',
  friend:        '#9A4AD9',
  caregiver:     '#4AD9CA',
  doctor:        '#D97B4A',
  default:       '#7A7A8A',
};

function relationColor(rel = '') {
  const key = rel.toLowerCase().replace(/\s/g, '');
  return RELATION_COLORS[key] ?? RELATION_COLORS.default;
}

function PersonCard({ person, ageLabel }) {
  const initials = (person.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const clr = relationColor(person.relation);
  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: clr + '22', borderColor: clr }]}>
        <Text style={[styles.avatarTxt, { color: clr }]}>{initials}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.name}>{person.name || 'Unknown'}</Text>
        <View style={styles.tagRow}>
          {person.relation ? (
            <View style={[styles.tag, { backgroundColor: clr + '22' }]}>
              <Text style={[styles.tagTxt, { color: clr }]}>{person.relation}</Text>
            </View>
          ) : null}
          {person.age ? (
            <View style={styles.tagGrey}>
              <Text style={styles.tagGreyTxt}>{ageLabel} {person.age}</Text>
            </View>
          ) : null}
          {person.city ? (
            <View style={styles.tagGrey}>
              <Text style={styles.tagGreyTxt}>📍 {person.city}</Text>
            </View>
          ) : null}
        </View>
        {person.last_visit ? <Text style={styles.lastVisit}>Last visit: {person.last_visit}</Text> : null}
        {person.notes ? <Text style={styles.notes} numberOfLines={2}>{person.notes}</Text> : null}
      </View>
    </View>
  );
}

export default function PeopleScreen({ navigation }) {
  const { t } = useTranslation();
  const [people,  setPeople]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPeople(getPatientId());
      setPeople(data.people || []);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = people.filter(p =>
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.relation?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder={t('peopleSearch')}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTxt}>{t('peopleLoading')}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>{t('peopleEmpty')}</Text>
          <Text style={styles.emptyBody}>{t('peopleEmptyBody')}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddMemory')}>
            <Text style={styles.addBtnTxt}>{t('peopleAddMemory')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => <PersonCard person={item} ageLabel={t('ageLabel')} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddMemory')}>
        <Text style={styles.fabTxt}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.bg },
  searchWrap: { padding: spacing.md, paddingBottom: spacing.sm },
  search:     { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontFamily: fonts.body, fontSize: 15 },
  list:       { padding: spacing.md },
  card:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  avatar:     { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, borderWidth: 2 },
  avatarTxt:  { fontFamily: fonts.bold, fontSize: 18 },
  cardInfo:   { flex: 1 },
  name:       { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginBottom: 4 },
  tagRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  tag:        { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagTxt:     { fontFamily: fonts.body, fontSize: 12, textTransform: 'capitalize' },
  tagGrey:    { backgroundColor: colors.bgSubtle, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  tagGreyTxt: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  lastVisit:  { fontSize: 12, color: colors.textMuted, fontFamily: fonts.body, marginBottom: 2 },
  notes:      { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.body, lineHeight: 18 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingTxt: { marginTop: spacing.sm, color: colors.textMuted, fontFamily: fonts.body },
  emptyIcon:  { fontSize: 52, marginBottom: spacing.md },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, marginBottom: spacing.sm },
  emptyBody:  { textAlign: 'center', color: colors.textMuted, fontFamily: fonts.body, lineHeight: 22 },
  addBtn:     { marginTop: spacing.lg, backgroundColor: colors.accent, borderRadius: radii.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  addBtnTxt:  { color: '#fff', fontFamily: fonts.bold, fontSize: 15 },
  fab:        { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  fabTxt:     { color: '#fff', fontSize: 26, lineHeight: 30 },
});

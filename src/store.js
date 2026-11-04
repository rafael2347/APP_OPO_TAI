import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY = 'tai-app-v1';
export const empty = { q: {}, history: [], cards: {} };
export async function load() {
  try { const r = await AsyncStorage.getItem(KEY); return r ? { ...empty, ...JSON.parse(r) } : empty; } catch { return empty; }
}
export async function save(s) { try { await AsyncStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

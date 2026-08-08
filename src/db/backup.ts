import type { Album, Artist, ListenEvent, Track } from '../types';
import { db } from './dexie';

export const BACKUP_SCHEMA_VERSION = 1;
const LAST_EXPORT_KEY = 'spottied.last_export_at';

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  listenEvents: ListenEvent[];
}

export interface ImportSummary {
  artists: number;
  albums: number;
  tracks: number;
  listenEvents: number;
  mode: 'merge' | 'replace';
}

export function getLastExportAt(): string | null {
  return localStorage.getItem(LAST_EXPORT_KEY);
}

export async function buildBackup(): Promise<BackupFile> {
  const [artists, albums, tracks, listenEvents] = await Promise.all([
    db.artists.toArray(),
    db.albums.toArray(),
    db.tracks.toArray(),
    db.listenEvents.toArray(),
  ]);
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    artists,
    albums,
    tracks,
    listenEvents,
  };
}

export async function exportBackup(): Promise<void> {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `digging-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  localStorage.setItem(LAST_EXPORT_KEY, backup.exportedAt);
}

export function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text) as Partial<BackupFile>;
  if (data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `지원하지 않는 백업 버전입니다 (버전 ${String(data.schemaVersion)})`,
    );
  }
  if (
    !Array.isArray(data.artists) ||
    !Array.isArray(data.albums) ||
    !Array.isArray(data.tracks) ||
    !Array.isArray(data.listenEvents)
  ) {
    throw new Error('백업 파일 형식이 올바르지 않습니다');
  }
  return data as BackupFile;
}

export async function importBackup(
  backup: BackupFile,
  mode: 'merge' | 'replace',
): Promise<ImportSummary> {
  await db.transaction(
    'rw',
    db.artists,
    db.albums,
    db.tracks,
    db.listenEvents,
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.artists.clear(),
          db.albums.clear(),
          db.tracks.clear(),
          db.listenEvents.clear(),
        ]);
      }
      // Merge = union by ids (bulkPut overwrites same-id rows);
      // ListenEvents are deduped by id the same way.
      await db.artists.bulkPut(backup.artists);
      await db.albums.bulkPut(backup.albums);
      await db.tracks.bulkPut(backup.tracks);
      await db.listenEvents.bulkPut(backup.listenEvents);
    },
  );
  return {
    artists: backup.artists.length,
    albums: backup.albums.length,
    tracks: backup.tracks.length,
    listenEvents: backup.listenEvents.length,
    mode,
  };
}

export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    db.artists,
    db.albums,
    db.tracks,
    db.listenEvents,
    async () => {
      await Promise.all([
        db.artists.clear(),
        db.albums.clear(),
        db.tracks.clear(),
        db.listenEvents.clear(),
      ]);
    },
  );
  localStorage.removeItem(LAST_EXPORT_KEY);
}

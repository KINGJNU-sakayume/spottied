import { useRef, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import {
  exportBackup,
  importBackup,
  parseBackup,
  wipeAllData,
  type BackupFile,
  type ImportSummary,
} from '../db/backup';
import { disconnectSpotify, getRedirectUri } from '../lib/spotify/client';
import { beginLogin } from '../lib/spotify/pkce';
import { useArtistStore } from '../store/artistStore';
import { useLogStore } from '../store/logStore';
import { useUiStore } from '../store/uiStore';
import { useOnline } from '../utils/hooks';

export default function Settings() {
  const pushToast = useUiStore((s) => s.pushToast);
  const refreshConnected = useUiStore((s) => s.refreshConnected);
  const setNeedsReconnect = useUiStore((s) => s.setNeedsReconnect);
  const connected = useUiStore((s) => s.spotifyConnected);
  const online = useOnline();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const reloadStores = async () => {
    await Promise.all([
      useArtistStore.getState().loadAll(),
      useLogStore.getState().loadAll(),
    ]);
  };

  const onExport = async () => {
    try {
      await exportBackup();
      pushToast('백업 파일을 내보냈어요');
    } catch {
      pushToast('내보내기에 실패했어요');
    }
  };

  const onPickFile = async (file: File) => {
    try {
      const backup = parseBackup(await file.text());
      setSummary(null);
      setPendingBackup(backup);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : '백업 파일을 읽지 못했어요');
    }
  };

  const onImport = async (mode: 'merge' | 'replace') => {
    if (!pendingBackup) return;
    if (mode === 'replace') {
      if (!window.confirm('기존 데이터를 모두 지우고 백업으로 교체할까요?')) return;
      if (!window.confirm('정말로 교체할까요? 되돌릴 수 없어요.')) return;
    }
    try {
      const result = await importBackup(pendingBackup, mode);
      await reloadStores();
      setPendingBackup(null);
      setSummary(result);
      pushToast('가져오기가 완료되었어요');
    } catch {
      pushToast('가져오기에 실패했어요');
    }
  };

  const onWipe = async () => {
    if (!window.confirm('모든 데이터를 삭제할까요? 백업부터 권장해요.')) return;
    if (!window.confirm('정말로 삭제할까요? 되돌릴 수 없어요.')) return;
    await wipeAllData();
    await reloadStores();
    pushToast('모든 데이터를 삭제했어요');
  };

  return (
    <div>
      <h1 className="mb-4 text-[28px] font-bold tracking-tight">설정</h1>

      <div className="space-y-4">
        <GlassCard className="p-4">
          <h2 className="mb-1 text-sm font-bold">Spotify</h2>
          <p className="mb-3 text-xs text-ink/45">
            검색·디스코그래피 가져오기·동기화에만 사용돼요. 연결 없이도 저장된
            데이터는 모두 사용할 수 있어요.
          </p>
          {connected ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-emerald-600">연결됨</span>
              <button
                type="button"
                className="glass-inset rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:text-ink"
                onClick={() => {
                  disconnectSpotify();
                  refreshConnected();
                  setNeedsReconnect(false);
                  pushToast('Spotify 연결을 해제했어요');
                }}
              >
                연결 해제
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!online}
              title={online ? undefined : '오프라인'}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
              onClick={() => void beginLogin()}
            >
              Spotify 연결
            </button>
          )}
          <p className="mt-3 break-all text-[11px] text-ink/30">
            Redirect URI: {getRedirectUri()}
          </p>
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="mb-1 text-sm font-bold">백업</h2>
          <p className="mb-3 text-xs text-ink/45">
            모든 데이터는 이 브라우저에만 저장돼요. 브라우저 데이터를 지우면 기록도
            사라지니 주기적으로 내보내 주세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="glass-inset rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:text-ink"
              onClick={() => void onExport()}
            >
              JSON 내보내기
            </button>
            <button
              type="button"
              className="glass-inset rounded-full px-4 py-2 text-sm font-semibold text-ink/70 hover:text-ink"
              onClick={() => fileInputRef.current?.click()}
            >
              JSON 가져오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void onPickFile(file);
              }}
            />
          </div>

          {pendingBackup && (
            <div className="glass-inset fade-in mt-4 rounded-[18px] p-3">
              <p className="text-sm">
                아티스트 {pendingBackup.artists.length} · 앨범{' '}
                {pendingBackup.albums.length} · 트랙 {pendingBackup.tracks.length} ·
                청취 기록 {pendingBackup.listenEvents.length}
              </p>
              <p className="mt-0.5 text-xs text-ink/40">
                내보낸 시각: {pendingBackup.exportedAt}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
                  onClick={() => void onImport('merge')}
                >
                  병합
                </button>
                <button
                  type="button"
                  className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
                  onClick={() => void onImport('replace')}
                >
                  전체 교체
                </button>
                <button
                  type="button"
                  className="rounded-full bg-ink/[0.07] px-4 py-2 text-sm font-semibold text-ink/60"
                  onClick={() => setPendingBackup(null)}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {summary && (
            <p className="fade-in mt-3 text-xs text-ink/50">
              {summary.mode === 'merge' ? '병합' : '전체 교체'} 완료 — 아티스트{' '}
              {summary.artists}, 앨범 {summary.albums}, 트랙 {summary.tracks}, 청취
              기록 {summary.listenEvents}
            </p>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="mb-1 text-sm font-bold">데이터</h2>
          <p className="mb-3 text-xs text-ink/45">
            모든 아티스트·앨범·트랙·청취 기록을 삭제해요.
          </p>
          <button
            type="button"
            className="rounded-full bg-rose-500/12 px-4 py-2 text-sm font-semibold text-rose-600 ring-1 ring-inset ring-rose-500/20 hover:bg-rose-500/20"
            onClick={() => void onWipe()}
          >
            전체 데이터 삭제
          </button>
        </GlassCard>
      </div>
    </div>
  );
}

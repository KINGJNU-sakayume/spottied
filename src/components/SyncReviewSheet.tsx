import { useEffect, useState } from 'react';
import { SpotifyAuthError } from '../lib/spotify/client';
import { getRecentlyPlayed } from '../lib/spotify/endpoints';
import { beginLogin } from '../lib/spotify/pkce';
import { useArtistStore } from '../store/artistStore';
import { useLogStore } from '../store/logStore';
import { useUiStore } from '../store/uiStore';
import type { SpotifyImage } from '../types';
import { formatTime } from '../utils/format';

interface SyncCandidate {
  trackId: string;
  trackName: string;
  artistName: string;
  albumImages: SpotifyImage[];
  playedAt: string;
}

type SheetState =
  | { kind: 'loading' }
  | { kind: 'auth-error' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; candidates: SyncCandidate[] };

/**
 * Propose–approve Spotify sync: recently-played plays on tracked artists
 * with unlistened tracks are proposed; nothing is ever written without
 * explicit confirmation. Deduped by (trackId, playedAt).
 */
export function SyncReviewSheet({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<SheetState>({ kind: 'loading' });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const items = await getRecentlyPlayed();
        const store = useArtistStore.getState();
        const log = useLogStore.getState();

        // Tracked albums whose tracks are not cached yet: fetch lazily so
        // their plays can be matched too (sequential queue inside).
        const missingAlbumIds = new Set<string>();
        for (const item of items) {
          const albumId = item.track.album.id;
          if (store.albums[albumId] && !store.tracks[item.track.id]) {
            missingAlbumIds.add(albumId);
          }
        }
        for (const albumId of missingAlbumIds) {
          await store.ensureAlbumTracks(albumId);
        }

        const fresh = useArtistStore.getState();
        const seen = new Set<string>();
        const candidates: SyncCandidate[] = [];
        for (const item of items) {
          const track = fresh.tracks[item.track.id];
          if (!track || track.status !== 'none') continue;
          const dedupeKey = `${item.track.id}@${item.played_at}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          if (log.hasEvent(item.track.id, item.played_at)) continue;
          candidates.push({
            trackId: item.track.id,
            trackName: item.track.name,
            artistName: item.track.artists.map((a) => a.name).join(', '),
            albumImages: item.track.album.images,
            playedAt: item.played_at,
          });
        }
        if (cancelled) return;
        setChecked(
          Object.fromEntries(
            candidates.map((c) => [`${c.trackId}@${c.playedAt}`, true]),
          ),
        );
        setState({ kind: 'ready', candidates });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof SpotifyAuthError) {
          setState({ kind: 'auth-error' });
        } else {
          setState({
            kind: 'error',
            message: e instanceof Error ? e.message : '동기화에 실패했어요',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = async () => {
    if (state.kind !== 'ready' || applying) return;
    const selected = state.candidates.filter(
      (c) => checked[`${c.trackId}@${c.playedAt}`],
    );
    setApplying(true);
    const markListened = useArtistStore.getState().markListened;
    for (const c of selected) {
      await markListened(c.trackId, {
        listenedAt: c.playedAt,
        source: 'spotify-sync',
      });
    }
    pushToast(`${selected.length}개의 청취를 기록했어요`);
    onClose();
  };

  const selectedCount =
    state.kind === 'ready'
      ? state.candidates.filter((c) => checked[`${c.trackId}@${c.playedAt}`]).length
      : 0;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fade-in absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="sheet-in glass-deep absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:inset-x-auto md:left-1/2 md:w-[28rem] md:-translate-x-1/2 md:rounded-b-3xl md:bottom-auto md:top-20">
        <h2 className="mb-1 text-lg font-bold">Spotify에서 가져오기</h2>
        <p className="mb-4 text-sm text-white/50">
          최근 재생 기록 중 디깅 중인 트랙만 보여드려요. 확인 후 기록됩니다.
        </p>

        {state.kind === 'loading' && (
          <p className="py-10 text-center text-sm text-white/40">불러오는 중…</p>
        )}

        {state.kind === 'auth-error' && (
          <div className="py-8 text-center">
            <p className="mb-4 text-sm text-white/60">Spotify 연결이 필요해요.</p>
            <button
              type="button"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
              onClick={() => void beginLogin()}
            >
              Spotify 연결
            </button>
          </div>
        )}

        {state.kind === 'error' && (
          <p className="py-10 text-center text-sm text-white/50">{state.message}</p>
        )}

        {state.kind === 'ready' && state.candidates.length === 0 && (
          <p className="py-10 text-center text-sm text-white/50">
            새로 확인된 청취 없음
          </p>
        )}

        {state.kind === 'ready' && state.candidates.length > 0 && (
          <>
            <ul className="space-y-1">
              {state.candidates.map((c) => {
                const key = `${c.trackId}@${c.playedAt}`;
                const smallest = [...c.albumImages].sort(
                  (a, b) => (a.width ?? Infinity) - (b.width ?? Infinity),
                )[0];
                return (
                  <li key={key}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={Boolean(checked[key])}
                        onChange={(e) =>
                          setChecked((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                        className="h-4 w-4 accent-white"
                      />
                      {smallest ? (
                        <img
                          src={smallest.url}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover ring-1 ring-inset ring-white/10"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-white/10" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{c.trackName}</span>
                        <span className="block truncate text-xs text-white/45">
                          {c.artistName}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-white/40">
                        {formatTime(c.playedAt)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              disabled={selectedCount === 0 || applying}
              className="mt-4 w-full rounded-full bg-white py-3 text-sm font-semibold text-black transition-opacity disabled:opacity-40"
              onClick={() => void apply()}
            >
              {applying ? '기록 중…' : `${selectedCount}개 기록하기`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

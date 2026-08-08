import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pickImage } from '../components/CoverImage';
import { SearchIcon } from '../components/Icons';
import { StatusBadge } from '../components/StatusBadge';
import {
  MISSING_CLIENT_ID_MESSAGE,
  SpotifyAuthError,
  hasTokens,
  isClientIdConfigured,
} from '../lib/spotify/client';
import {
  SEARCH_PAGE_SIZE,
  searchArtists,
  type SpotifyArtistObject,
} from '../lib/spotify/endpoints';
import { beginLogin } from '../lib/spotify/pkce';
import { useArtistStore } from '../store/artistStore';
import { useUiStore } from '../store/uiStore';
import { getArtistStatus } from '../utils/derive';
import { useOnline, useTracksByAlbum } from '../utils/hooks';

export default function Search() {
  const [query, setQuery] = useState('');
  // A Hangul IME reports every intermediate jamo through onChange, so
  // searching mid-composition fires requests for fragments like "ㅇ".
  const [composing, setComposing] = useState(false);
  const [results, setResults] = useState<SpotifyArtistObject[]>([]);
  const [searching, setSearching] = useState(false);
  // A failed search must never render as "no results".
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const online = useOnline();
  const pushToast = useUiStore((s) => s.pushToast);

  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const importing = useArtistStore((s) => s.importingArtistIds);
  const addArtist = useArtistStore((s) => s.addArtist);
  const tracksByAlbum = useTracksByAlbum();
  const albumList = useMemo(() => Object.values(albums), [albums]);

  const connected = hasTokens();

  useEffect(() => {
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q === '' || !connected) {
      setResults([]);
      setSearching(false);
      setError(null);
      setHasMore(false);
      return;
    }
    if (composing) return;
    setSearching(true);
    debounceRef.current = window.setTimeout(() => {
      void searchArtists(q, 0)
        .then((page) => {
          setResults(page.items);
          setHasMore(page.hasMore);
          setError(null);
        })
        .catch((e: unknown) => {
          const message =
            e instanceof Error ? e.message : '검색에 실패했어요';
          setResults([]);
          setHasMore(false);
          setError(message);
          if (!(e instanceof SpotifyAuthError)) pushToast(message);
        })
        .finally(() => setSearching(false));
    }, 400);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [query, composing, connected, pushToast]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await searchArtists(query.trim(), results.length);
      // De-dupe: paging over a shifting result set can repeat an artist.
      setResults((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        return [...prev, ...page.items.filter((a) => !seen.has(a.id))];
      });
      setHasMore(page.hasMore);
    } catch (e) {
      const message = e instanceof Error ? e.message : '더 불러오지 못했어요';
      setError(message);
      pushToast(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const startDigging = async (result: SpotifyArtistObject) => {
    try {
      await addArtist(result);
      navigate(`/artist/${result.id}`);
    } catch {
      pushToast('디스코그래피를 가져오지 못했어요');
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-[28px] font-bold tracking-tight">검색</h1>

      {!isClientIdConfigured() ? (
        <div className="glass mt-16 rounded-[22px] p-5 text-center">
          <p className="text-sm font-semibold text-ink/80">
            Spotify 설정이 완료되지 않았어요
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink/55">
            {MISSING_CLIENT_ID_MESSAGE}
          </p>
        </div>
      ) : !connected ? (
        <div className="mt-24 text-center">
          <p className="text-sm text-ink/50">
            아티스트 검색에는 Spotify 연결이 필요해요.
          </p>
          <button
            type="button"
            disabled={!online}
            title={online ? undefined : '오프라인'}
            className="mt-5 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
            onClick={() => void beginLogin()}
          >
            Spotify 연결
          </button>
        </div>
      ) : (
        <>
          <div className="glass-inset flex items-center gap-2.5 rounded-[20px] px-4 py-3">
            <SearchIcon size={17} className="shrink-0 text-ink/35" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(e) => {
                setComposing(false);
                setQuery(e.currentTarget.value);
              }}
              placeholder="아티스트 검색"
              disabled={!online}
              title={online ? undefined : '오프라인'}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink/30 disabled:opacity-40"
            />
          </div>

          <div className="mt-4 space-y-2">
            {searching && (
              <p className="py-8 text-center text-sm text-ink/40">검색 중…</p>
            )}
            {!searching &&
              results.map((result) => {
                const tracked = artists[result.id];
                const img = pickImage(result.images, 56);
                return (
                  <div
                    key={result.id}
                    className="glass flex cursor-pointer items-center gap-3 rounded-[20px] p-3 transition-colors hover:bg-white/30"
                    onClick={() => {
                      if (tracked) navigate(`/artist/${result.id}`);
                    }}
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={result.name}
                        className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-inset ring-ink/10"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-full bg-ink/[0.06]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{result.name}</p>
                      {(result.genres ?? []).length > 0 && (
                        <p className="truncate text-xs text-ink/45">
                          {(result.genres ?? []).slice(0, 3).join(' · ')}
                        </p>
                      )}
                    </div>
                    {tracked ? (
                      <StatusBadge
                        status={getArtistStatus(tracked, albumList, tracksByAlbum)}
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(importing[result.id]) || !online}
                        title={online ? undefined : '오프라인'}
                        className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-40"
                        onClick={(e) => {
                          e.stopPropagation();
                          void startDigging(result);
                        }}
                      >
                        {importing[result.id] ? '가져오는 중…' : '디깅 시작'}
                      </button>
                    )}
                  </div>
                );
              })}
            {!searching && error && (
              <div className="glass rounded-[20px] p-4 text-center">
                <p className="text-sm font-semibold text-rose-600">
                  검색에 실패했어요
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/60">
                  {error}
                </p>
              </div>
            )}
            {!searching && !error && query.trim() !== '' && results.length === 0 && (
              <p className="py-8 text-center text-sm text-ink/40">
                검색 결과가 없어요
              </p>
            )}
            {!searching && !error && hasMore && (
              <button
                type="button"
                disabled={loadingMore || !online}
                title={online ? undefined : '오프라인'}
                className="glass w-full rounded-[20px] py-3 text-sm font-semibold text-ink/70 transition-colors hover:text-ink disabled:opacity-40"
                onClick={() => void loadMore()}
              >
                {loadingMore ? '불러오는 중…' : `더 보기 (${SEARCH_PAGE_SIZE}개씩)`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

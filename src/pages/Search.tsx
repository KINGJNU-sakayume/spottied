import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pickImage } from '../components/CoverImage';
import { SearchIcon } from '../components/Icons';
import { StatusBadge } from '../components/StatusBadge';
import { SpotifyAuthError, hasTokens } from '../lib/spotify/client';
import { searchArtists, type SpotifyArtistObject } from '../lib/spotify/endpoints';
import { beginLogin } from '../lib/spotify/pkce';
import { useArtistStore } from '../store/artistStore';
import { useUiStore } from '../store/uiStore';
import { getArtistStatus } from '../utils/derive';
import { useOnline, useTracksByAlbum } from '../utils/hooks';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyArtistObject[]>([]);
  const [searching, setSearching] = useState(false);
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
      return;
    }
    setSearching(true);
    debounceRef.current = window.setTimeout(() => {
      void searchArtists(q)
        .then((items) => {
          setResults(items);
        })
        .catch((e: unknown) => {
          if (!(e instanceof SpotifyAuthError)) {
            pushToast('검색에 실패했어요');
          }
        })
        .finally(() => setSearching(false));
    }, 400);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [query, connected, pushToast]);

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
      <h1 className="mb-4 text-2xl font-bold">검색</h1>

      {!connected ? (
        <div className="mt-24 text-center">
          <p className="text-sm text-white/50">
            아티스트 검색에는 Spotify 연결이 필요해요.
          </p>
          <button
            type="button"
            disabled={!online}
            title={online ? undefined : '오프라인'}
            className="mt-5 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black disabled:opacity-40"
            onClick={() => void beginLogin()}
          >
            Spotify 연결
          </button>
        </div>
      ) : (
        <>
          <div className="glass flex items-center gap-2.5 rounded-2xl px-4 py-3">
            <SearchIcon size={17} className="shrink-0 text-white/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="아티스트 검색"
              disabled={!online}
              title={online ? undefined : '오프라인'}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-white/30 disabled:opacity-40"
            />
          </div>

          <div className="mt-4 space-y-2">
            {searching && (
              <p className="py-8 text-center text-sm text-white/40">검색 중…</p>
            )}
            {!searching &&
              results.map((result) => {
                const tracked = artists[result.id];
                const img = pickImage(result.images, 56);
                return (
                  <div
                    key={result.id}
                    className="glass flex cursor-pointer items-center gap-3 rounded-2xl p-3"
                    onClick={() => {
                      if (tracked) navigate(`/artist/${result.id}`);
                    }}
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={result.name}
                        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-inset ring-white/10"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-full bg-white/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{result.name}</p>
                      {result.genres.length > 0 && (
                        <p className="truncate text-xs text-white/45">
                          {result.genres.slice(0, 3).join(' · ')}
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
                        className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-opacity disabled:opacity-40"
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
            {!searching && query.trim() !== '' && results.length === 0 && (
              <p className="py-8 text-center text-sm text-white/40">
                검색 결과가 없어요
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

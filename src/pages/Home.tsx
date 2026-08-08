import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AmbientBackdrop } from '../components/AmbientBackdrop';
import { CoverImage, pickImage } from '../components/CoverImage';
import { PlayIcon, RefreshIcon } from '../components/Icons';
import { ProgressBar } from '../components/ProgressBar';
import { SyncReviewSheet } from '../components/SyncReviewSheet';
import { getLastExportAt } from '../db/backup';
import { spotifyAlbumUrl } from '../lib/spotify/endpoints';
import { useArtistStore } from '../store/artistStore';
import { useLogStore } from '../store/logStore';
import type { Artist } from '../types';
import { rgba, useDominantColor } from '../utils/color';
import {
  formatResumeText,
  getAlbumProgress,
  getArtistStatus,
  getResumePoint,
  type TracksByAlbum,
} from '../utils/derive';
import { useOnline, useTracksByAlbum } from '../utils/hooks';

function DiggingCard({
  artist,
  tracksByAlbum,
}: {
  artist: Artist;
  tracksByAlbum: TracksByAlbum;
}) {
  const albums = useArtistStore((s) => s.albums);
  const albumList = useMemo(() => Object.values(albums), [albums]);
  const rp = getResumePoint(artist, albumList, tracksByAlbum);
  const coverUrl = rp ? pickImage(rp.album.images, 160) : undefined;
  const accent = useDominantColor(coverUrl);

  if (!rp) return null;
  const progress = getAlbumProgress(rp.album, tracksByAlbum[rp.album.id] ?? []);

  return (
    <div className="glass relative overflow-hidden rounded-[26px]">
      <AmbientBackdrop imageUrl={coverUrl} />
      <div className="relative flex gap-4 p-4">
        <CoverImage
          images={rp.album.images}
          alt={rp.album.name}
          sizePx={112}
          rounded="rounded-2xl"
          className="w-24 shrink-0 shadow-xl md:w-28"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="min-w-0">
            <Link
              to={`/artist/${artist.id}`}
              className="block truncate text-lg font-bold"
            >
              {artist.name}
            </Link>
            <p className="mt-0.5 truncate text-sm text-ink/55">
              {formatResumeText(rp)}
            </p>
          </div>
          <div>
            <ProgressBar
              value={progress.ratio}
              accent={rgba(accent, 0.95)}
              className="mb-3"
            />
            <div className="flex items-center gap-2">
              <a
                href={spotifyAlbumUrl(rp.album.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md ring-1 ring-inset ring-white/25 transition-transform active:scale-95"
                style={{ background: rgba(accent, 1) }}
              >
                <PlayIcon size={13} />
                이어서 듣기
              </a>
              <Link
                to={`/artist/${artist.id}`}
                className="glass-inset whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-ink/65 transition-colors hover:text-ink"
              >
                아티스트
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackupReminder({ hasData }: { hasData: boolean }) {
  const events = useLogStore((s) => s.events);
  const artists = useArtistStore((s) => s.artists);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !hasData) return null;
  const lastExport = getLastExportAt();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  if (lastExport && lastExport > thirtyDaysAgo) return null;
  const since = lastExport ?? '';
  const hasNewRecords =
    events.some((e) => e.listenedAt > since) ||
    Object.values(artists).some((a) => a.addedAt > since);
  if (!hasNewRecords) return null;

  return (
    <div className="glass mb-4 flex items-center gap-3 rounded-[20px] p-3">
      <p className="min-w-0 flex-1 text-sm text-ink/65">
        {lastExport
          ? '마지막 백업이 30일이 넘었어요. 데이터를 내보내 주세요.'
          : '기록은 이 브라우저에만 저장돼요. 주기적으로 백업해 주세요.'}
      </p>
      <Link
        to="/settings"
        className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-white transition-transform active:scale-95"
      >
        백업하기
      </Link>
      <button
        type="button"
        className="shrink-0 text-sm text-ink/40 hover:text-ink/70"
        onClick={() => setDismissed(true)}
      >
        나중에
      </button>
    </div>
  );
}

export default function Home() {
  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const loaded = useArtistStore((s) => s.loaded);
  const events = useLogStore((s) => s.events);
  const tracksByAlbum = useTracksByAlbum();
  const online = useOnline();
  const [syncOpen, setSyncOpen] = useState(false);

  const groups = useMemo(() => {
    const albumList = Object.values(albums);
    const lastListen = new Map<string, string>();
    for (const e of events) {
      const prev = lastListen.get(e.artistId);
      if (!prev || e.listenedAt > prev) lastListen.set(e.artistId, e.listenedAt);
    }
    const inProgress: Artist[] = [];
    const completed: Artist[] = [];
    const notStarted: Artist[] = [];
    for (const artist of Object.values(artists)) {
      const status = getArtistStatus(artist, albumList, tracksByAlbum);
      if (status === 'in-progress') inProgress.push(artist);
      else if (status === 'completed') completed.push(artist);
      else notStarted.push(artist);
    }
    const recency = (a: Artist) => lastListen.get(a.id) ?? a.addedAt;
    inProgress.sort((a, b) => recency(b).localeCompare(recency(a)));
    completed.sort((a, b) => recency(b).localeCompare(recency(a)));
    notStarted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return { inProgress, completed, notStarted };
  }, [artists, albums, events, tracksByAlbum]);

  const hasAny = Object.keys(artists).length > 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-bold tracking-tight">홈</h1>
        <button
          type="button"
          disabled={!online}
          title={online ? undefined : '오프라인'}
          className="glass inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold text-ink/70 transition-colors hover:text-ink disabled:opacity-40"
          onClick={() => setSyncOpen(true)}
        >
          <RefreshIcon size={15} />
          Spotify에서 가져오기
        </button>
      </div>

      <BackupReminder hasData={hasAny || events.length > 0} />

      {!loaded ? null : !hasAny ? (
        <div className="mt-24 text-center">
          <p className="text-lg font-bold text-ink/80">
            아직 디깅 중인 아티스트가 없어요
          </p>
          <p className="mt-1 text-sm text-ink/40">
            검색에서 아티스트를 추가하면 여기서 이어 들을 수 있어요.
          </p>
          <Link
            to="/search"
            className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-transform active:scale-95"
          >
            아티스트 검색하기
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.inProgress.length > 0 && (
            <section className="space-y-3">
              {groups.inProgress.map((artist) => (
                <DiggingCard
                  key={artist.id}
                  artist={artist}
                  tracksByAlbum={tracksByAlbum}
                />
              ))}
            </section>
          )}

          {groups.completed.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold text-ink/45">완주</h2>
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                {groups.completed.map((artist) => (
                  <Link
                    key={artist.id}
                    to={`/artist/${artist.id}`}
                    className="w-20 shrink-0"
                  >
                    <CoverImage
                      images={artist.images}
                      alt={artist.name}
                      sizePx={80}
                      rounded="rounded-full"
                      className="w-20 shadow-md"
                    />
                    <p className="mt-1.5 truncate text-center text-xs font-medium text-ink/70">
                      {artist.name}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {groups.notStarted.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold text-ink/45">미시작</h2>
              <div className="flex flex-wrap gap-2">
                {groups.notStarted.map((artist) => {
                  const img = pickImage(artist.images, 24);
                  return (
                    <Link
                      key={artist.id}
                      to={`/artist/${artist.id}`}
                      className="glass flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-medium text-ink/75 transition-colors hover:text-ink"
                    >
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-ink/10" />
                      )}
                      {artist.name}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {syncOpen && <SyncReviewSheet onClose={() => setSyncOpen(false)} />}
    </div>
  );
}

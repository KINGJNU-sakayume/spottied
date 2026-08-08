import { useState } from 'react';
import { Link } from 'react-router-dom';
import { spotifyAlbumUrl } from '../lib/spotify/endpoints';
import { useArtistStore } from '../store/artistStore';
import { useUiStore } from '../store/uiStore';
import type { Album, Track } from '../types';
import { cn } from '../utils/cn';
import { getAlbumProgress, getAlbumTypeLabel } from '../utils/derive';
import { releaseYear } from '../utils/format';
import { useAlbumLinkState, useIsMobile } from '../utils/hooks';
import type { TileRef } from '../utils/useLazyAlbumTracks';
import { BackdateDialog } from './BackdateDialog';
import { CoverImage } from './CoverImage';
import { CheckIcon } from './Icons';
import { OverflowMenu } from './OverflowMenu';
import { StarRating } from './StarRating';

/**
 * One cell of the discography wall. Progress lives on the artwork itself —
 * unheard covers are dimmed and desaturated, so filling the grid in reads as
 * the covers coming into focus one by one.
 */
export function AlbumTile({
  album,
  tracks,
  accent,
  tileRef,
}: {
  album: Album;
  tracks: Track[];
  /** rgba string lifted from the artist header — extracting per tile is costly. */
  accent: string;
  tileRef?: TileRef;
}) {
  const markAlbumListened = useArtistStore((s) => s.markAlbumListened);
  const undoAlbumListened = useArtistStore((s) => s.undoAlbumListened);
  const setAlbumExcluded = useArtistStore((s) => s.setAlbumExcluded);
  const updateAlbum = useArtistStore((s) => s.updateAlbum);
  const pushToast = useUiStore((s) => s.pushToast);
  const [menuOpen, setMenuOpen] = useState(false);
  const [backdateOpen, setBackdateOpen] = useState(false);
  const isMobile = useIsMobile();
  const linkState = useAlbumLinkState();

  const progress = getAlbumProgress(album, tracks);
  const remaining = Math.max(progress.total - progress.processed, 0);
  const untouched = progress.processed === 0;

  const markAll = async (listenedAt?: string) => {
    const snapshot = await markAlbumListened(album.id, listenedAt);
    if (!snapshot) return;
    pushToast(`${snapshot.createdEventIds.length}곡 청취 처리`, {
      action: {
        label: '실행 취소',
        onClick: () => void undoAlbumListened(snapshot),
      },
    });
  };

  const onToggleListened = async () => {
    if (progress.complete) {
      const ok = window.confirm(
        `『${album.name}』의 청취 기록을 전부 해제할까요?`,
      );
      if (!ok) return;
      await Promise.all(
        tracks
          .filter((t) => t.status !== 'none')
          .map((t) => useArtistStore.getState().setTrackStatus(t.id, 'none')),
      );
      pushToast(`『${album.name}』 청취 기록을 해제했어요`);
      return;
    }
    await markAll();
  };

  const badge = progress.complete ? (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm ring-1 ring-inset ring-white/30"
      style={{ background: accent }}
    >
      <CheckIcon size={15} />
    </span>
  ) : !progress.tracksKnown ? (
    // Dashed = "we don't know yet", distinct from a confirmed zero.
    <span className="block h-7 w-7 rounded-full border border-dashed border-white/80 bg-ink/20 shadow-sm" />
  ) : untouched ? (
    <span className="block h-7 w-7 rounded-full border-[1.5px] border-white/90 bg-ink/15 shadow-sm" />
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-[11px] font-bold tabular-nums text-ink shadow-sm">
      {remaining}
    </span>
  );

  return (
    <div ref={tileRef} className="min-w-0">
      <div className="relative">
        <Link
          to={`/album/${album.id}`}
          state={linkState}
          aria-label={`${album.name} 앨범 열기`}
          className="group block overflow-hidden rounded-[10px] transition-transform duration-150 active:scale-[0.97]"
        >
          <CoverImage
            images={album.images}
            alt={album.name}
            sizePx={160}
            rounded="rounded-[10px]"
            className={cn(
              'w-full shadow-md transition-[filter,opacity] duration-300',
              untouched && 'opacity-50 grayscale-[0.4]',
            )}
          />
          {!progress.complete && !untouched && progress.tracksKnown && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-ink/20">
              <span
                className="block h-full transition-[width] duration-300 ease-out"
                style={{ width: `${progress.ratio * 100}%`, background: accent }}
              />
            </span>
          )}
        </Link>

        {/* 28px dot, 40px hit area via padding. */}
        <button
          type="button"
          aria-label={
            progress.complete
              ? `${album.name} 청취 기록 전체 해제`
              : `${album.name} 전부 청취 처리`
          }
          className="group/badge absolute -right-1.5 -top-1.5 p-1.5 transition-transform duration-150 active:scale-90"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void onToggleListened();
          }}
        >
          <span className="relative block">
            {badge}
            {/* Pressing reveals a check so the dot reads as a button. */}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 group-active/badge:opacity-100">
              <CheckIcon size={15} />
            </span>
          </span>
        </button>
      </div>

      <div className="mt-1.5 flex items-start gap-1">
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">
          {album.name}
        </p>
        <div className="-mt-1 shrink-0">
          <OverflowMenu
            label={`${album.name} 메뉴`}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            items={[
              {
                label: '다른 날짜로 기록',
                onSelect: () => setBackdateOpen(true),
              },
              {
                label: '목록에서 제외',
                onSelect: () => void setAlbumExcluded(album.id, true),
              },
              { label: 'Spotify에서 열기', href: spotifyAlbumUrl(album.id) },
            ]}
          />
        </div>
      </div>
      <p className="truncate text-[11px] text-ink/40">
        {releaseYear(album.releaseDate)} · {getAlbumTypeLabel(album)}
      </p>
      <StarRating
        size={isMobile ? 16 : 18}
        value={album.rating}
        onChange={(v) => void updateAlbum(album.id, { rating: v })}
        className="mt-1"
      />

      {backdateOpen && (
        <BackdateDialog
          title={album.name}
          onConfirm={(listenedAt) => void markAll(listenedAt)}
          onClose={() => setBackdateOpen(false)}
        />
      )}
    </div>
  );
}

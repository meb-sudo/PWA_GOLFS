import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { useNews, useNotifications } from '@/lib/queries';
import type { NotificationItem } from '@golf/contracts';
import {
  Card, EmptyState, ErrorState, SkeletonList, SectionTitle, Badge, Button,
} from '@/components/ui';
import { Screen, PageHeader, Sheet } from '@/components/layout';
import { IconNews, IconBell, IconTrash } from '@/components/icons';
import { formatDateSafe, formatDateTimeSafe } from '@/lib/format';
import {
  getSeenNotifs, markNotifsSeen, getDeletedNotifs, deleteNotif,
} from '@/lib/notifs';
import { sanitizeArticle, toPlainText, hardenLinks } from '@/lib/richText';
import { useT } from '@/i18n';

export function NewsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useNews();
  const news = data?.news ?? [];

  return (
    <Screen className="flex flex-col gap-5 pt-safe">
      <header className="pt-2">
        <SectionTitle eyebrow={t('news.yourClub')} title={t('home.news')} />
      </header>

      {isPending ? (
        <SkeletonList rows={3} height="h-48" />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : news.length === 0 ? (
        <EmptyState
          title={t('news.noneTitle')}
          description={t('news.noneDesc')}
          icon={<IconNews width={30} height={30} />}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {news.map((item, i) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.25), duration: 0.25 }}
            >
              <Card
                onClick={() => navigate(`/actualites/${item.id}`)}
                className="overflow-hidden"
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    className="h-44 w-full object-cover"
                  />
                )}
                <div className="p-4">
                  {item.publishedAt && (
                    <p className="text-xs text-[var(--color-ink-faint)]">{formatDateSafe(item.publishedAt)}</p>
                  )}
                  <p className="mt-1 font-medium">{item.title}</p>
                  {item.excerpt && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-soft)]">
                      {toPlainText(item.excerpt)}
                    </p>
                  )}
                </div>
              </Card>
            </motion.li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

export function NewsDetailScreen() {
  const t = useT();
  const { id = '' } = useParams();
  const { data, isPending } = useNews();
  const item = data?.news.find((n) => n.id === id);
  const bodyRef = useRef<HTMLDivElement>(null);

  const body = useMemo(() => sanitizeArticle(item?.body), [item?.body]);
  const excerpt = useMemo(() => toPlainText(item?.excerpt), [item?.excerpt]);

  // Les liens de l article partent vers l exterieur : nouvel onglet, sans
  // acces a la fenetre appelante.
  useEffect(() => { hardenLinks(bodyRef.current); }, [body]);

  if (isPending) {
    return (
      <div>
        <PageHeader title={t('news.article')} />
        <main className="px-4 py-5"><SkeletonList rows={3} height="h-32" /></main>
      </div>
    );
  }

  if (!item) {
    return (
      <div>
        <PageHeader title={t('news.article')} />
        <main className="px-4 py-5">
          <EmptyState title={t('news.notFound')} />
        </main>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title={t('news.article')} />
      <article className="flex flex-col gap-4">
        {item.image && (
          <img src={item.image} alt="" className="h-56 w-full object-cover" />
        )}
        <div className="flex flex-col gap-3 px-4">
          {item.publishedAt && (
            <p className="text-xs text-[var(--color-ink-faint)]">{formatDateSafe(item.publishedAt)}</p>
          )}
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
            {item.title}
          </h1>
          {excerpt && <p className="text-[var(--color-ink-soft)]">{excerpt}</p>}
          {body && (
            <div
              ref={bodyRef}
              className="article text-[var(--color-ink)]"
              // Contenu assaini par richText.ts : balises et attributs sur
              // liste blanche, styles en dur retires.
              dangerouslySetInnerHTML={{ __html: body }}
            />
          )}
        </div>
      </article>
    </div>
  );
}

export function NotificationsScreen() {
  const t = useT();
  const { data, isPending, isError, error, refetch } = useNotifications();
  const all = data?.notifications ?? [];

  // "Vu" fige a l ouverture (surlignage des nouveautes) ; supprimes masques.
  const [seenAtOpen] = useState(() => getSeenNotifs());
  const [deleted, setDeleted] = useState(() => getDeletedNotifs());
  const [selected, setSelected] = useState<NotificationItem | null>(null);

  const notifications = all.filter((n) => !deleted.has(n.id));

  useEffect(() => {
    markNotifsSeen(notifications.map((n) => n.id));
  }, [notifications]);

  // Suppression locale, comme DELETE_NOTIFICATION (NOTIF_EST_INACTIF) WinDev.
  function remove(id: string): void {
    deleteNotif(id);
    setDeleted((prev) => new Set(prev).add(id));
    setSelected((cur) => (cur?.id === id ? null : cur));
  }

  return (
    <div className="pb-10">
      <PageHeader title={t('menu.notifications')} />
      <main className="flex flex-col gap-3 px-4 py-5">
        {isPending ? (
          <SkeletonList rows={4} height="h-20" />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : notifications.length === 0 ? (
          <EmptyState
            title={t('news.noNotifTitle')}
            description={t('news.noNotifDesc')}
            icon={<IconBell width={30} height={30} />}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {notifications.map((n) => (
              <li key={n.id}>
                <div
                  className={clsx(
                    'flex items-start gap-3 rounded-[var(--radius-card)] border p-4',
                    seenAtOpen.has(n.id)
                      ? 'border-[var(--color-line)] bg-[var(--color-surface)]'
                      : 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10',
                  )}
                >
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-alt)]">
                    <IconBell width={17} height={17} />
                  </span>
                  {/* Tap : ouvre le detail sur place (pas de navigation). */}
                  <button
                    type="button"
                    onClick={() => setSelected(n)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-medium">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-ink-soft)]">
                        {n.body}
                      </p>
                    )}
                    {n.sentAt && (
                      <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
                        {formatDateTimeSafe(n.sentAt)}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    aria-label={t('news.deleteNotif')}
                    className="mt-0.5 shrink-0 rounded-full p-1.5 text-[var(--color-ink-faint)] active:bg-[var(--color-surface-alt)]"
                  >
                    <IconTrash width={17} height={17} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Detail : contenu complet, sans quitter l ecran (FEN_NOTIFICATION_DETAIL). */}
      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? t('news.notification')}
      >
        {selected && (
          <div className="flex flex-col gap-4">
            {selected.sentAt && (
              <p className="text-sm text-[var(--color-ink-faint)]">
                {formatDateTimeSafe(selected.sentAt)}
              </p>
            )}
            <p className="text-[0.95rem] leading-relaxed whitespace-pre-line text-[var(--color-ink)]">
              {selected.body || t('news.noContent')}
            </p>
            <Button
              variant="outline"
              full
              onClick={() => remove(selected.id)}
              icon={<IconTrash width={18} height={18} />}
              className="text-[var(--color-danger)]"
            >
              {t('news.deleteThisNotif')}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

export { Badge };

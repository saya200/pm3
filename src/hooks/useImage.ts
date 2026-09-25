import { useEffect, useState } from 'react';
import { getImage } from '../data/api';

export function useImage(imageId: string | null): { src: string | null; failed: boolean } {
  const [state, setState] = useState<{ id: string | null; src: string | null; failed: boolean }>({
    id: null,
    src: null,
    failed: false,
  });
  useEffect(() => {
    if (!imageId) return;
    let alive = true;
    getImage(imageId)
      .then((src) => alive && setState({ id: imageId, src, failed: !src }))
      .catch(() => alive && setState({ id: imageId, src: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [imageId]);
  if (!imageId || state.id !== imageId) return { src: null, failed: false };
  return { src: state.src, failed: state.failed };
}

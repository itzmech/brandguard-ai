import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';

type ReviewActionsMenuProps = {
  onView: () => void;
  onDelete?: () => void;
};

export function ReviewActionsMenu({
  onView,
  onDelete,
}: ReviewActionsMenuProps) {
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuPosition) return;

    const closeMenu = () => setMenuPosition(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [menuPosition]);

  const toggleMenu = () => {
    if (menuPosition) {
      setMenuPosition(null);
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const menuHeight = onDelete ? 96 : 50;
    const openUpward = rect.bottom + menuHeight > window.innerHeight - 8;
    setMenuPosition({
      right: Math.max(8, window.innerWidth - rect.right),
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  const runAction = (action: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    setMenuPosition(null);
    action();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toggleMenu();
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue"
        aria-label="More actions"
        aria-expanded={menuPosition !== null}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </button>
      {menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="fixed z-[1000] w-40 rounded-lg border border-border-default bg-white py-1 shadow-lg"
            style={menuPosition}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={runAction(onView)}
              className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary-blue"
            >
              Open review
            </button>
            {onDelete && (
              <button
                type="button"
                role="menuitem"
                onClick={runAction(onDelete)}
                className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-rose-600"
              >
                Delete
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

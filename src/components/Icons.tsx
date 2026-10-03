// أيقونات SVG بسيطة (بدون رموز تعبيرية بالواجهة)
type P = { size?: number; className?: string };
const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const PlusIcon = ({ size = 18, className }: P) => svg(size, className, <path d="M12 5v14M5 12h14" />);
export const ChevronDown = ({ size = 18, className }: P) => svg(size, className, <path d="m6 9 6 6 6-6" />);
export const XIcon = ({ size = 18, className }: P) => svg(size, className, <path d="M18 6 6 18M6 6l12 12" />);
// في الواجهة العربية "إرسال" يتجه لليسار
export const SendIcon = ({ size = 18, className }: P) => svg(size, className, <path d="M19 12H5m6-6-6 6 6 6" />);
export const ListIcon = ({ size = 16, className }: P) =>
  svg(size, className, <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />);
export const GridIcon = ({ size = 16, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>,
  );
export const BellIcon = ({ size = 18, className }: P) =>
  svg(size, className, <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />);
export const ImageIcon = ({ size = 18, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </>,
  );
export const EditIcon = ({ size = 15, className }: P) =>
  svg(size, className, <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />);
export const ArchiveIcon = ({ size = 15, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M10 13h4" />
    </>,
  );
export const TrashIcon = ({ size = 15, className }: P) =>
  svg(size, className, <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />);
export const CopyIcon = ({ size = 15, className }: P) =>
  svg(
    size,
    className,
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>,
  );
export const ReplyIcon = ({ size = 14, className }: P) =>
  svg(size, className, <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
export const ShareIcon = ({ size = 16, className }: P) =>
  svg(size, className, <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />);
export const BookIcon = ({ size = 18, className }: P) =>
  svg(
    size,
    className,
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" />,
  );
export const FileDownIcon = ({ size = 15, className }: P) =>
  svg(
    size,
    className,
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" />
      <path d="M14 2v6h6M12 11v6M9.5 14.5 12 17l2.5-2.5" />
    </>,
  );

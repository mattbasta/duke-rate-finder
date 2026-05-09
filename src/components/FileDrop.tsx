import { useCallback, useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
  busyLabel?: string;
}

export default function FileDrop({ onFile, busy, busyLabel }: Props) {
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setHover(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
        hover ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white'
      } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <input
        type="file"
        accept=".xml,application/xml,text/xml"
        ref={inputRef}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = '';
        }}
      />
      <div className="text-lg font-semibold text-slate-700">
        {busy ? (busyLabel ?? 'Working…') : 'Drop your Duke Energy XML here'}
      </div>
      <div className="mt-1 text-sm text-slate-500">
        Or click to choose. Files are processed locally in your browser — nothing is uploaded.
      </div>
    </div>
  );
}

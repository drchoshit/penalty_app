import React from "react";

export function Modal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-soft border border-slate-100 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-base font-semibold">{title}</div>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  );
}

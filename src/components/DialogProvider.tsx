"use client";

import { createContext, useCallback, useContext, useState } from "react";
import Modal from "./Modal";

interface DialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
}

interface DialogContextValue {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (options: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue>({
  alert: async () => {},
  confirm: async () => false,
});

export function useDialog() {
  return useContext(DialogContext);
}

export default function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<{
    type: "alert" | "confirm";
    options: DialogOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const alert = useCallback((message: string, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        type: "alert",
        options: { message, title: title || "알림" },
        resolve: () => resolve(),
      });
    });
  }, []);

  const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        type: "confirm",
        options: { title: "확인", ...options },
        resolve,
      });
    });
  }, []);

  const close = (result: boolean) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const isDanger = dialog?.options.variant === "danger";

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.options.title || "알림"}
      >
        <div className="space-y-5">
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {dialog?.options.message}
          </p>
          <div className="flex justify-end gap-2">
            {dialog?.type === "confirm" && (
              <button
                onClick={() => close(false)}
                className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover transition-colors"
              >
                {dialog.options.cancelLabel || "취소"}
              </button>
            )}
            <button
              onClick={() => close(true)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDanger
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-accent text-white hover:bg-accent-hover"
              }`}
            >
              {dialog?.options.confirmLabel || "확인"}
            </button>
          </div>
        </div>
      </Modal>
    </DialogContext.Provider>
  );
}

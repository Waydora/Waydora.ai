import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}
            className="border-0 text-white shadow-2xl"
            style={{
              background: "rgba(22,14,38,0.97)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "14px",
            }}>
            <div className="grid gap-1">
              {title && <ToastTitle className="text-white font-bold">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-white/70">{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className="text-white/50 hover:text-white" />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
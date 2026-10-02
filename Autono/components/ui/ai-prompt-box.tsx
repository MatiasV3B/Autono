import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUp, Paperclip, Square, X, Globe, FolderCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BorderBeam } from "./border-beam";

// Utility function for className merging
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none scrollbar-thin scrollbar-thumb-[#444444] scrollbar-track-transparent hover:scrollbar-thumb-[#555555]",
      className
    )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// Tooltip Components
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-[#333333] bg-[#1F2023] px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Dialog Components
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-[#333333] bg-[#1F2023] p-0 shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-[#2E3033]/80 p-2 hover:bg-[#2E3033] transition-all">
        <X className="h-5 w-5 text-gray-200 hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-gray-100", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-white hover:bg-white/80 text-black",
      outline: "border border-[#444444] bg-transparent hover:bg-[#3A3A40]",
      ghost: "bg-transparent hover:bg-[#3A3A40]",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// ImageViewDialog Component
interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}
const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-[90vw] md:max-w-[800px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative bg-[#1F2023] rounded-2xl overflow-hidden shadow-2xl"
        >
          <img
            src={imageUrl}
            alt="Full preview"
            className="w-full max-h-[80vh] object-contain rounded-2xl"
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// PromptInput Context and Components
interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-3xl border border-[#444444] bg-[#1F2023] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300",
              isLoading && "border-red-500/70",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
}
const PromptInputTextarea: React.FC<PromptInputTextareaProps & React.ComponentProps<typeof Textarea>> = ({
  className,
  onKeyDown,
  disableAutosize = false,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-base", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {}
const PromptInputActions: React.FC<PromptInputActionsProps> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

interface PromptInputActionProps extends React.ComponentProps<typeof Tooltip> {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}
const PromptInputAction: React.FC<PromptInputActionProps> = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

// Custom Divider Component
const CustomDivider: React.FC = () => (
  <div className="relative h-6 w-[1.5px] mx-1">
    <div
      className="absolute inset-0 bg-gradient-to-t from-transparent via-[#9b87f5]/70 to-transparent rounded-full"
      style={{
        clipPath: "polygon(0% 0%, 100% 0%, 100% 40%, 140% 50%, 100% 60%, 100% 100%, 0% 100%, 0% 60%, -40% 50%, 0% 40%)",
      }}
    />
  </div>
);

// Main PromptInputBox Component
export interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[], mode?: "chat" | "search" | "think" | "canvas") => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}
export const PromptInputBox = React.forwardRef((props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
  const { onSend = () => {}, isLoading = false, placeholder = "Envía un mensaje a Antigravity...", className } = props;
  const [input, setInput] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showCanvas, setShowCanvas] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);

  const handleSearchToggle = () => setShowSearch((prev) => !prev);
  const handleCanvasToggle = () => setShowCanvas((prev) => !prev);

  const isImageFile = (file: File) => file.type.startsWith("image/");

  const processFile = (file: File) => {
    if (!isImageFile(file)) {
      console.log("Solo se permiten archivos de imagen");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      console.log("Archivo demasiado grande (máx 10MB)");
      return;
    }
    setFiles([file]);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreviews({ [file.name]: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const imageFiles = droppedFiles.filter((file) => isImageFile(file));
    if (imageFiles.length > 0) processFile(imageFiles[0]);
  }, []);

  const handleRemoveFile = (index: number) => {
    const fileToRemove = files[index];
    if (fileToRemove && filePreviews[fileToRemove.name]) setFilePreviews({});
    setFiles([]);
  };

  const openImageModal = (imageUrl: string) => setSelectedImage(imageUrl);

  const handlePaste = React.useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          break;
        }
      }
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleSubmit = () => {
    if (input.trim() || files.length > 0) {
      let mode: "chat" | "search" | "think" | "canvas" = "chat";
      if (showCanvas) mode = "canvas";
      else if (showSearch) mode = "search";

      onSend(input, files, mode);
      setInput("");
      setFiles([]);
      setFilePreviews({});
    }
  };

  const hasContent = input.trim() !== "" || files.length > 0;

  return (
    <>
      <BorderBeam size="md" colorVariant="colorful">
        <PromptInput
          value={input}
          onValueChange={setInput}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          className={cn(
            "w-full bg-[#1F2023] border-[#444444] shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300 ease-in-out",
            className
          )}
          disabled={isLoading}
          ref={ref || promptBoxRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 p-0 pb-1 transition-all duration-300">
              {files.map((file, index) => (
                <div key={index} className="relative group">
                  {file.type.startsWith("image/") && filePreviews[file.name] && (
                    <div
                      className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 border border-white/10"
                      onClick={() => openImageModal(filePreviews[file.name])}
                    >
                      <img
                        src={filePreviews[file.name]}
                        alt={file.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 opacity-100 transition-opacity hover:bg-black"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="transition-all duration-300 opacity-100">
            <PromptInputTextarea
              placeholder={
                showSearch
                  ? "Buscar en la página y web..."
                  : showCanvas
                  ? "Modo Cowork (acciones autónomas)..."
                  : placeholder
              }
              className="text-base"
            />
          </div>

          <PromptInputActions className="flex items-center justify-between gap-2 p-0 pt-2">
            <div className="flex items-center gap-1 transition-opacity duration-300 opacity-100 visible">
              <PromptInputAction tooltip="Adjuntar foto/captura">
                <motion.button
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex h-8 w-8 text-[#9CA3AF] cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/10 hover:text-white"
                  type="button"
                >
                  <Paperclip className="h-4 w-4 transition-colors" />
                  <input
                    ref={uploadInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0]);
                      if (e.target) e.target.value = "";
                    }}
                    accept="image/*"
                  />
                </motion.button>
              </PromptInputAction>

              <div className="flex items-center">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={handleSearchToggle}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-1 px-2.5 py-1 border h-8 font-medium text-xs",
                    showSearch
                      ? "bg-[#1EAEDB]/18 border-[#1EAEDB] text-[#1EAEDB] shadow-[0_0_10px_rgba(30,174,219,0.35)]"
                      : "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#ececec] hover:bg-white/5"
                  )}
                >
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <Globe className={cn("w-3.5 h-3.5 transition-transform duration-200", showSearch ? "text-[#1EAEDB] scale-110" : "text-inherit")} />
                  </div>
                  <span>Search</span>
                </motion.button>

                <CustomDivider />

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={handleCanvasToggle}
                  className={cn(
                    "rounded-full transition-all flex items-center gap-1 px-2.5 py-1 border h-8 font-medium text-xs",
                    showCanvas
                      ? "bg-[#F97316]/18 border-[#F97316] text-[#F97316] shadow-[0_0_10px_rgba(249,115,22,0.35)]"
                      : "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#ececec] hover:bg-white/5"
                  )}
                >
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <FolderCode className={cn("w-3.5 h-3.5 transition-transform duration-200", showCanvas ? "text-[#F97316] scale-110" : "text-inherit")} />
                  </div>
                  <span>Cowork</span>
                </motion.button>
              </div>
            </div>

            <PromptInputAction
              tooltip={
                isLoading
                  ? "Detener generación"
                  : hasContent
                  ? "Enviar mensaje"
                  : "Escribe un mensaje"
              }
            >
              <motion.button
                type="button"
                whileHover={hasContent && !isLoading ? { scale: 1.12 } : undefined}
                whileTap={hasContent && !isLoading ? { scale: 0.92 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 focus-visible:outline-none",
                  isLoading
                    ? "bg-white text-[#1F2023] cursor-pointer shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                    : hasContent
                    ? "bg-white hover:bg-white/90 text-[#1F2023] cursor-pointer shadow-[0_2px_10px_rgba(255,255,255,0.25)]"
                    : "bg-[#2a2a2a] text-[#555555] cursor-not-allowed opacity-55 scale-95"
                )}
                onClick={() => {
                  if (hasContent && !isLoading) handleSubmit();
                }}
                disabled={!hasContent && !isLoading}
              >
                {isLoading ? (
                  <Square className="h-3.5 w-3.5 fill-[#1F2023] animate-pulse" />
                ) : (
                  <ArrowUp className={cn("h-4 w-4 stroke-[2.5]", hasContent ? "text-[#1F2023]" : "text-[#555555]")} />
                )}
              </motion.button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </BorderBeam>

      <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );
});
PromptInputBox.displayName = "PromptInputBox";

export default PromptInputBox;

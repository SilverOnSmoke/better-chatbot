"use client";

import {
  AudioWaveformIcon,
  ChevronDown,
  CornerRightUp,
  Pause,
  Brain,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Button } from "ui/button";
import { FileUploadComponent, FilePreview } from "./file-upload";
import { UseChatHelpers } from "@ai-sdk/react";
import { SelectModel } from "./select-model";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import {
  ChatMention,
  ChatMessageAnnotation,
  ChatModel,
  ChatAttachment,
} from "app-types/chat";
import dynamic from "next/dynamic";
import { ToolModeDropdown } from "./tool-mode-dropdown";

import { ToolSelectDropdown } from "./tool-select-dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { useTranslations } from "next-intl";
import { Editor } from "@tiptap/react";
import { WorkflowSummary } from "app-types/workflow";
import { useFileUpload } from "@/hooks/use-file-upload";
import { cn } from "lib/utils";

interface PromptInputProps {
  placeholder?: string;
  setInput: (value: string) => void;
  input: string;
  onStop: () => void;
  append: UseChatHelpers["append"];
  toolDisabled?: boolean;
  isLoading?: boolean;
  model?: ChatModel;
  setModel?: (model: ChatModel) => void;
  voiceDisabled?: boolean;
  threadId?: string;
  disabledMention?: boolean;
  onFocus?: () => void;
  thinking?: boolean;
  onThinkingChange?: (thinking: boolean) => void;
}

const ChatMentionInput = dynamic(() => import("./chat-mention-input"), {
  ssr: false,
  loading() {
    return <div className="h-[2rem] w-full animate-pulse"></div>;
  },
});

export default function PromptInput({
  placeholder,
  append,
  model,
  setModel,
  input,
  setInput,
  onStop,
  isLoading,
  toolDisabled,
  voiceDisabled,
  threadId,
  disabledMention,
  onFocus,
  thinking,
  onThinkingChange,
}: PromptInputProps) {
  const t = useTranslations("Chat");

  const [currentThreadId, globalModel, appStoreMutate, uploadedFiles] =
    appStore(
      useShallow((state) => [
        state.currentThreadId,
        state.chatModel,
        state.mutate,
        state.uploadedFiles,
      ]),
    );

  const chatModel = useMemo(() => {
    return model ?? globalModel;
  }, [model, globalModel]);

  const editorRef = useRef<Editor | null>(null);

  const setChatModel = useCallback(
    (model: ChatModel) => {
      if (setModel) {
        setModel(model);
      } else {
        appStoreMutate({ chatModel: model });
      }
    },
    [setModel, appStoreMutate],
  );

  const [toolMentionItems, setToolMentionItems] = useState<ChatMention[]>([]);

  const { readFromClipboard } = useFileUpload();

  const hasClipboardSupport = useCallback(() => {
    return Boolean(navigator.clipboard && navigator.clipboard.read);
  }, []);

  // Suppress unused variable warnings for optional props
  // These props are accepted for backward compatibility but may not be fully implemented
  void threadId;

  const onSelectWorkflow = useCallback((workflow: WorkflowSummary) => {
    const workflowMention: ChatMention = {
      type: "workflow",
      workflowId: workflow.id,
      icon: workflow.icon,
      name: workflow.name,
      description: workflow.description,
    };
    editorRef.current
      ?.chain()

      .insertContent({
        type: "mention",
        attrs: {
          label: `${workflow.name} `,
          id: JSON.stringify(workflowMention),
        },
      })
      .focus()
      .run();
  }, []);

  const submit = () => {
    if (isLoading) return;
    const userMessage = input?.trim() || "";
    if (userMessage.length === 0 && uploadedFiles.length === 0) return;

    const annotations: ChatMessageAnnotation[] = [];
    if (toolMentionItems.length > 0) {
      annotations.push({
        mentions: toolMentionItems,
      });
    }

    // Convert uploaded files to attachments
    const attachments: ChatAttachment[] = uploadedFiles.map((file) => ({
      url: file.url,
      contentType: file.type,
      size: file.size,
    }));

    setToolMentionItems([]);
    appStoreMutate({ uploadedFiles: [] });
    setInput("");

    append!({
      role: "user",
      content: "",
      annotations,
      experimental_attachments: attachments,
      parts: [
        {
          type: "text",
          text: userMessage,
        },
      ],
    });
  };

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      // Check if clipboard contains image data
      if (!hasClipboardSupport()) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      // Check if any item is an image
      const hasImage = Array.from(items).some((item) =>
        item.type.startsWith("image/"),
      );
      if (!hasImage) return;

      // Prevent default paste behavior when images are detected
      event.preventDefault();

      try {
        const clipboardFiles = await readFromClipboard();
        if (clipboardFiles.length > 0) {
          appStoreMutate((state) => ({
            uploadedFiles: [...state.uploadedFiles, ...clipboardFiles],
          }));
        }
      } catch (error) {
        console.error("Failed to handle clipboard paste:", error);
      }
    },
    [hasClipboardSupport, readFromClipboard, appStoreMutate],
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  return (
    <div className="max-w-3xl mx-auto fade-in animate-in">
      <div className="z-10 mx-auto w-full max-w-3xl relative">
        <div className="flex w-full min-w-0 max-w-full flex-col px-4">
          <div className="rounded-4xl backdrop-blur-sm transition-all duration-200 bg-muted/60 relative flex w-full flex-col cursor-text z-10 items-stretch focus-within:bg-muted hover:bg-muted p-3">
            <div className="flex flex-col gap-3.5 px-1">
              {uploadedFiles.length > 0 && (
                <FilePreview
                  files={uploadedFiles}
                  onRemove={(index) => {
                    appStoreMutate((state) => ({
                      uploadedFiles: state.uploadedFiles.filter(
                        (_, i) => i !== index,
                      ),
                    }));
                  }}
                  className="px-1"
                />
              )}
              <div className="relative min-h-[2rem]">
                <ChatMentionInput
                  input={input}
                  onChange={setInput}
                  onChangeMention={setToolMentionItems}
                  onEnter={submit}
                  placeholder={placeholder ?? t("placeholder")}
                  ref={editorRef}
                  disabledMention={disabledMention}
                  onFocus={onFocus}
                />
              </div>
              <div className="flex w-full items-center gap-[1px]  z-30">
                <FileUploadComponent
                  onFilesUploaded={(files) => {
                    appStoreMutate((state) => ({
                      uploadedFiles: [...state.uploadedFiles, ...files],
                    }));
                  }}
                />

                {!toolDisabled && (
                  <>
                    <ToolModeDropdown />
                    <ToolSelectDropdown
                      align="start"
                      side="top"
                      onSelectWorkflow={onSelectWorkflow}
                      mentions={toolMentionItems}
                    />
                  </>
                )}

                {/* Sequential Thinking Toggle */}
                {onThinkingChange && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={thinking ? "default" : "ghost"}
                        size={"sm"}
                        className={cn(
                          "rounded-full p-2",
                          thinking && "bg-primary text-primary-foreground",
                        )}
                        onClick={() => onThinkingChange(!thinking)}
                      >
                        <Brain size={16} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {thinking ? "Disable" : "Enable"} Sequential Thinking
                    </TooltipContent>
                  </Tooltip>
                )}

                <div className="flex-1" />

                <SelectModel onSelect={setChatModel} defaultModel={chatModel}>
                  <Button
                    variant={"ghost"}
                    size={"sm"}
                    className="rounded-full data-[state=open]:bg-input! hover:bg-input! mr-1"
                  >
                    {chatModel?.model ?? (
                      <span className="text-muted-foreground">model</span>
                    )}
                    <ChevronDown className="size-3" />
                  </Button>
                </SelectModel>
                {!isLoading && !input.length && !voiceDisabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size={"sm"}
                        onClick={() => {
                          appStoreMutate((state) => ({
                            voiceChat: {
                              ...state.voiceChat,
                              isOpen: true,
                              threadId: currentThreadId ?? undefined,
                            },
                          }));
                        }}
                        className="rounded-full p-2!"
                      >
                        <AudioWaveformIcon size={16} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("VoiceChat.title")}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div
                    onClick={() => {
                      if (isLoading) {
                        onStop();
                      } else {
                        submit();
                      }
                    }}
                    className="fade-in animate-in cursor-pointer text-muted-foreground rounded-full p-2 bg-secondary hover:bg-accent-foreground hover:text-accent transition-all duration-200"
                  >
                    {isLoading ? (
                      <Pause
                        size={16}
                        className="fill-muted-foreground text-muted-foreground"
                      />
                    ) : (
                      <CornerRightUp size={16} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

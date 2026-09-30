import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';

export interface ChatMessage {
  id: string;
  senderId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface InGameChatProps {
  messages: ChatMessage[];
  myPlayerId: string;
  onSendMessage: (text: string) => void;
}

export default function InGameChat({ messages, myPlayerId, onSendMessage }: InGameChatProps) {
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Press "/" or Enter anywhere in the window to focus chat input (like real Roblox)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (e.key === '/' || e.key === 'Enter') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText('');
    inputRef.current?.blur();
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 w-72 sm:w-88 flex flex-col font-sans select-none pointer-events-auto">
      {/* Messages Feed */}
      <div
        className={`p-2.5 rounded-t-lg transition-all space-y-1.5 max-h-48 overflow-y-auto ${
          isFocused || messages.length > 0
            ? 'bg-[#121417]/85 backdrop-blur-md border border-b-0 border-neutral-700/60 shadow-xl'
            : 'bg-transparent'
        }`}
      >
        {messages.length === 0 && isFocused && (
          <div className="text-[11px] text-neutral-400 italic">
            Welcome to chat! Type a message and press Enter.
          </div>
        )}

        {messages.slice(-12).map((msg) => {
          const isMe = msg.senderId === myPlayerId;
          return (
            <div key={msg.id} className="text-xs leading-snug break-words animate-fade-in flex items-start gap-1.5">
              <span
                className={`font-black shrink-0 ${
                  isMe ? 'text-blue-400' : 'text-emerald-400'
                }`}
              >
                [{msg.username}]:
              </span>
              <span className="text-white font-medium drop-shadow-sm">{msg.text}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={handleSend}
        className={`flex items-center gap-2 px-3 py-2 rounded-b-lg border transition-all ${
          isFocused
            ? 'bg-[#181a1f]/95 border-neutral-600 shadow-2xl'
            : 'bg-[#141619]/70 hover:bg-[#181a1f]/85 border-neutral-800 backdrop-blur-md shadow-md'
        }`}
      >
        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isFocused ? 'text-blue-400' : 'text-neutral-400'}`} />
        <input
          ref={inputRef}
          type="text"
          placeholder={isFocused ? 'Type your message...' : 'To chat click here or press /'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            // Stop game movement keys (WASD, Space) from propagating while typing!
            e.stopPropagation();
            if (e.key === 'Escape') {
              inputRef.current?.blur();
            }
          }}
          className="flex-1 bg-transparent text-xs text-white placeholder-neutral-400 focus:outline-none"
          maxLength={140}
        />
        {inputText.trim() && (
          <button
            type="submit"
            className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors shadow-sm"
            title="Send (Enter)"
          >
            <Send className="w-3 h-3" />
          </button>
        )}
      </form>
    </div>
  );
}

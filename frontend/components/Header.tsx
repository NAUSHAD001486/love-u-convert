'use client';

import { useScrollDirection } from '@/hooks/useScrollDirection';

export default function Header() {
  const isVisible = useScrollDirection();

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-[50px] bg-white z-50 transition-transform duration-300 border-b border-gray-200 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="h-full flex items-center pl-[4%]">
        <h1 className="text-[1.125rem] font-bold text-[#7C3AED]">Love U convert</h1>
      </div>
    </header>
  );
}


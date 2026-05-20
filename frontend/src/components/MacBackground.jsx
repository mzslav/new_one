export default function MacBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d1117] to-[#0a0a0f]" />

      {/* Animated orbs */}
      <div
        className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full opacity-30 blur-[100px] animate-float"
        style={{ background: 'radial-gradient(circle, #0A84FF 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-[-15%] right-[-10%] w-[700px] h-[700px] rounded-full opacity-25 blur-[120px] animate-float-delayed"
        style={{ background: 'radial-gradient(circle, #BF5AF2 0%, transparent 70%)' }}
      />
      <div
        className="absolute top-[40%] right-[20%] w-[400px] h-[400px] rounded-full opacity-20 blur-[80px] animate-float"
        style={{ background: 'radial-gradient(circle, #30D158 0%, transparent 70%)' }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]" />
    </div>
  );
}

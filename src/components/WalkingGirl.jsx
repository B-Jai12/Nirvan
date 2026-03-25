import girlWalkingMp4 from '../assets/girl-walking.mp4';

export default function WalkingGirl() {
  return (
    <video
      src={girlWalkingMp4}
      autoPlay
      loop
      muted
      playsInline
      style={{
        width: 480,
        height: 480,
        objectFit: 'contain',
        background: 'transparent',
        mixBlendMode: 'screen',
        borderRadius: '12px',
        pointerEvents: 'none',
      }}
    />
  );
}

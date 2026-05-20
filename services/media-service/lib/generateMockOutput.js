const WORDS = [
  'fluxon', 'signal', 'vector', 'neural', 'stream', 'buffer', 'pixel', 'frame',
  'audio', 'waveform', 'token', 'latency', 'render', 'codec', 'channel', 'sample',
  'alpha', 'beta', 'gamma', 'delta', 'quantum', 'matrix', 'tensor', 'epoch',
  'output', 'input', 'model', 'layer', 'node', 'graph', 'batch', 'seed',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomWords(count) {
  return Array.from({ length: count }, () => pick(WORDS)).join(' ');
}

function randomSentence() {
  return `${randomWords(randomInt(4, 10))}.`.replace(/^./, (c) => c.toUpperCase());
}

function randomParagraph(sentences = 3) {
  return Array.from({ length: sentences }, () => randomSentence()).join(' ');
}

function buildBody(actionType, sourceName) {
  const blocks = [];

  switch (actionType) {
    case 'TTS':
      blocks.push('=== Text-to-Speech script (mock) ===');
      blocks.push(randomParagraph(4));
      blocks.push('');
      blocks.push('Phoneme estimate: ' + randomInt(120, 890));
      break;
    case 'TRANSCRIBE':
      blocks.push('=== Transcription (mock) ===');
      blocks.push(randomParagraph(5));
      blocks.push('');
      blocks.push(`Confidence score: ${(Math.random() * 0.15 + 0.84).toFixed(3)}`);
      break;
    case 'SUMMARIZE':
      blocks.push('=== Summary (mock) ===');
      for (let i = 1; i <= randomInt(3, 6); i += 1) {
        blocks.push(`${i}. ${randomSentence()}`);
      }
      break;
    case 'TRANSLATE':
      blocks.push('=== Translation (mock) ===');
      blocks.push(`[${pick(['DE', 'FR', 'ES', 'PL', 'UK'])}] ${randomParagraph(3)}`);
      break;
    case 'ENHANCE':
      blocks.push('=== Enhancement report (mock) ===');
      blocks.push(`Source: ${sourceName}`);
      blocks.push(`Noise reduction: ${randomInt(12, 48)}%`);
      blocks.push(`Sharpness gain: +${randomInt(5, 22)}%`);
      blocks.push(`Bitrate estimate: ${randomInt(800, 4500)} kbps`);
      blocks.push(randomParagraph(2));
      break;
    default:
      blocks.push('=== Processed output (mock) ===');
      blocks.push(randomParagraph(3));
  }

  blocks.push('');
  blocks.push('--- Random payload ---');
  for (let i = 0; i < randomInt(4, 8); i += 1) {
    blocks.push(`${randomInt(100000, 999999)} | ${randomWords(randomInt(3, 7))} | hex:${randomInt(0xffff, 0xffffff).toString(16)}`);
  }

  return blocks.join('\n');
}

function generateMockOutput({ actionType, sourceName, jobId, userId }) {
  const header = [
    'Fluxon — AI Media Studio',
    'Mock processing result (local demo)',
    '',
    `Job ID:     ${jobId}`,
    `User ID:    ${userId}`,
    `Action:     ${actionType}`,
    `Source:     ${sourceName}`,
    `Created:    ${new Date().toISOString()}`,
    `Session:    ${randomInt(100000, 999999)}`,
    '',
  ].join('\n');

  const body = buildBody(actionType, sourceName);
  const content = `${header}${body}\n`;
  const buffer = Buffer.from(content, 'utf8');

  const baseName = (sourceName || 'media').replace(/\.[^.]+$/, '') || 'media';
  const processedName = `${baseName}_${actionType.toLowerCase()}_${randomInt(1000, 9999)}.txt`;

  return {
    buffer,
    processedName,
    mimetype: 'text/plain; charset=utf-8',
    size: buffer.length,
  };
}

module.exports = { generateMockOutput };

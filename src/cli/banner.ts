import pc from 'picocolors';

const WIDTH = 48;

function center(text: string, width: number): string {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  return `${' '.repeat(left)}${text}${' '.repeat(pad - left)}`;
}

export function renderBanner(): string {
  const inner = WIDTH - 2;
  const line1 = center('PERN STARTER', inner);
  const line2 = center('Production Project Generator', inner);
  return [
    pc.cyan(`╭${'─'.repeat(inner)}╮`),
    pc.cyan('│') + pc.bold(pc.white(line1)) + pc.cyan('│'),
    pc.cyan('│') + pc.dim(line2) + pc.cyan('│'),
    pc.cyan(`╰${'─'.repeat(inner)}╯`),
  ].join('\n');
}

export function printBanner(): void {
  console.log(renderBanner());
  console.log();
}

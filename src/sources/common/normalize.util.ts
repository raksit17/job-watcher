// src/source/common/normalize.util.ts

export function cleanText(
  value?: string | null,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const result =
    value
      .replace(/\s+/g, ' ')
      .trim();

  return result || undefined;
}

export function cleanLines(
  values?: string[],
): string[] {
  if (!values) {
    return [];
  }

  return values
    .map(value =>
      value
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}export function extractTechnologies(
  ...texts: Array<
    string | string[] | undefined
  >
): string[] {
  const content =
    texts
      .flatMap(value =>
        Array.isArray(value)
          ? value
          : [value ?? ''],
      )
      .join(' ')
      .toLowerCase();

  const technologies = [
    'nestjs',
    'node.js',
    'nodejs',
    'typescript',
    'javascript',
    'next.js',
    'nextjs',
    'react',
    'vue',
    'postgresql',
    'mysql',
    'mongodb',
    'redis',
    'docker',
    'kubernetes',
    'rabbitmq',
    'prisma',
    'graphql',
    'aws',
    'gcp',
  ];

  return technologies.filter(
    technology =>
      content.includes(
        technology.toLowerCase(),
      ),
  );
}
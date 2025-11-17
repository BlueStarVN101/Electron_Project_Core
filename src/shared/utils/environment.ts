export const isDevelopmentEnv = (env: NodeJS.ProcessEnv = process.env): boolean => {
  return env.NODE_ENV === 'development';
};

export const isProductionEnv = (env: NodeJS.ProcessEnv = process.env): boolean => {
  return env.NODE_ENV === 'production';
};


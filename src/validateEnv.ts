export const validateEnv = () => {
  const required = ['ALFRESCO_USERNAME', 'ALFRESCO_PASSWORD', 'ALFRESCO_URL'];
  const missing = required.filter(k => !process.env[k]);

  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
};

# Security Policy

## Supported Versions

This project is currently in active development. Security updates will be provided for the latest version.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Security Considerations

### Intended Use
This application is designed for **personal use only** and is intended to be deployed on a private network or behind Tailscale. It does not include authentication mechanisms as it's designed for single-user, private deployment.

### Deployment Security
- Deploy behind a firewall or VPN (Tailscale recommended)
- Use HTTPS in production (configure reverse proxy if needed)
- Keep your Raspberry Pi OS updated
- Use strong SSH keys for Pi access
- Regularly update Docker images

### Data Security
- All data is stored locally on your device
- No external API calls or data sharing
- Database files are stored in configurable local directories
- Logs contain no sensitive personal information

### Network Security
- Application runs on localhost by default
- Tailscale provides encrypted network access
- No external dependencies for core functionality

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **Do NOT** open a public issue
2. Email the maintainer directly (if contact provided)
3. Include detailed information about the vulnerability
4. Allow reasonable time for response and fix

## Security Best Practices for Deployment

### Raspberry Pi Security
- Change default passwords
- Enable SSH key authentication
- Disable password authentication for SSH
- Keep OS packages updated
- Configure automatic security updates
- Use a firewall if exposing to wider network

### Docker Security
- Regularly update base images
- Run containers as non-root user (already configured)
- Limit container resources
- Use Docker secrets for sensitive configuration

### Network Security
- Use Tailscale or VPN for remote access
- Avoid exposing directly to the internet
- Consider using a reverse proxy with HTTPS
- Monitor access logs

## Environment Variables

Never commit files containing:
- Database paths with sensitive data
- API keys or tokens
- Passwords or secrets
- Personal information

Use the provided `.env.example` files as templates and keep actual `.env` files local only.

## Updates

Security updates will be announced in:
- GitHub releases
- README.md file
- This SECURITY.md file

## Disclaimer

This software is provided "as is" without warranty. Users are responsible for securing their own deployments and data.
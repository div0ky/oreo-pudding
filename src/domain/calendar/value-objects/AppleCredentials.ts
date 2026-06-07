import { ValueObject } from "../../seedwork/ValueObject";

interface AppleCredentialsProps {
  appleId: string;
  appSpecificPassword: string;
}

export class AppleCredentials extends ValueObject<AppleCredentialsProps> {
  constructor(appleId: string, appSpecificPassword: string) {
    if (!appleId || appleId.trim() === "") {
      throw new Error("Apple ID cannot be empty.");
    }
    
    // Simple robust email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(appleId)) {
      throw new Error(`Invalid Apple ID format: '${appleId}'. Must be a valid email address.`);
    }

    if (!appSpecificPassword || appSpecificPassword.trim() === "") {
      throw new Error("App-Specific Password cannot be empty.");
    }

    // Standard Apple App-Specific Password format: xxxx-xxxx-xxxx-xxxx
    const aspRegex = /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/;
    if (!aspRegex.test(appSpecificPassword)) {
      throw new Error("Invalid App-Specific Password format. Must be formatted as xxxx-xxxx-xxxx-xxxx.");
    }

    super({
      appleId: appleId.trim(),
      appSpecificPassword: appSpecificPassword.trim()
    });
  }

  public get appleId(): string {
    return this.props.appleId;
  }

  public get appSpecificPassword(): string {
    return this.props.appSpecificPassword;
  }

  /**
   * Offers an immutable transformation method for Basic Authentication headers.
   */
  public toBasicAuthHeader(): string {
    const credentials = `${this.appleId}:${this.appSpecificPassword}`;
    // btoa is standard in modern JS runtimes, including Bun and browsers.
    const token = btoa(credentials);
    return `Basic ${token}`;
  }
}

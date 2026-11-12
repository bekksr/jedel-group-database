import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class DemoRegistrationService {
  private readonly profiles = new Map<string, string>();

  register(name: string, email: string): boolean {
    if (this.profiles.has(email)) return false;
    this.profiles.set(email, name);
    return true;
  }
}

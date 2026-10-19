import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface DemoItem {
  id: string;
  name: string;
  description: string;
}

export interface HelloResponse {
  message: string;
  subject: string;
  items: DemoItem[];
}

export interface EchoResponse {
  echoed: unknown;
  receivedAt: string;
}

/** Calls go to the same-origin BFF, which attaches the access token server-side. */
@Injectable({ providedIn: 'root' })
export class DemoApiService {
  private readonly http = inject(HttpClient);

  hello() {
    return this.http.get<HelloResponse>('/api/hello');
  }

  echo(message: string) {
    return this.http.post<EchoResponse>('/api/echo', { message });
  }
}

import { sessionInterceptor } from './app/auth';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from "@angular/common/http";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import { App } from "./app/app";
import { routes } from "./app/routes";
bootstrapApplication(App, {
  providers: [
    provideHttpClient(withXsrfConfiguration({cookieName: 'csrftoken', headerName: 'X-CSRFToken'}), withInterceptors([sessionInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: "enabled" }),
    ),
  ],
}).catch(console.error);

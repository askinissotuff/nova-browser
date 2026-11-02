import { Container } from "@cloudflare/containers";

export class NovaProxyContainer extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "30m";
  enableInternet = true;
  pingEndpoint = "/health";
  envVars = { NODE_ENV: "production", PORT: "8080" };
}

interface Env {
  NOVA_PROXY: DurableObjectNamespace<NovaProxyContainer>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const proxy = env.NOVA_PROXY.getByName("nova-browser");
    await proxy.startAndWaitForPorts();
    return proxy.fetch(request);
  }
};

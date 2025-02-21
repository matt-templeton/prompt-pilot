export interface ApiSurface {
  classes: ApiClass[];
  functions: ApiFunction[];
}

export interface ApiClass {
  name: string;
  description: string;
  methods: ApiMethod[];
  properties: ApiProperty[];
}

export interface ApiMethod {
  name: string;
  arguments: ApiArgument[];
  return_type: string;
  description: string;
}

export interface ApiProperty {
  name: string;
  type: string;
  description: string;
}

export interface ApiFunction {
  name: string;
  arguments: ApiArgument[];
  return_type: string;
  description: string;
}

export interface ApiArgument {
  name: string;
  type: string;
}

export interface ApiSurfaceCache {
  timestamp: number;
  hash: string;
  surface: ApiSurface;
}

export interface CacheManifest {
  version: string;
  entries: {
    [filePath: string]: string; // filepath -> hash
  };
} 
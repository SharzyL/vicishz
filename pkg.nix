{ lib
, stdenv
, nodejs
, pnpmConfigHook
, fetchPnpmDeps
, pnpm
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "vicishz";
  version = "0.1";

  src = with lib.fileset; toSource {
    root = ./.;
    fileset = fileFilter
      (file: ! (lib.elem file.name [ "flake.nix" "flake.lock" ]))
      ./.;
  };

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 3;
    hash = "sha256-XdRGKLfCLZ+TEDPB7p9Bnr/GKKVWRw8QXi7QF+l7Mys=";
  };

  buildPhase = ''
    runHook preBuild
    pnpm build -o $out
    runHook postBuild
  '';

  nativeBuildInputs = [
    nodejs
    pnpm
    pnpmConfigHook
  ];
})

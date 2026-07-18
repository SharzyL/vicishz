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
    fetcherVersion = 4;
    hash = "sha256-iHOBV1dCD4BsFfJa1iiqelRh/wTitzOrnb1KZ337XIg=";
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

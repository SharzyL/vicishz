{ lib
, stdenv
, nodejs
, yarn-berry
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

  offlineCache = yarn-berry.fetchYarnBerryDeps {
    inherit (finalAttrs) src missingHashes;
    hash = "sha256-+Znh7DHMwZwn5j8Oac3Cv8V4R9qvRWYVsh37GoObn1Q=";
  };

  buildPhase = ''
    runHook preBuild
    yarn build -o $out
    runHook postBuild
  '';

  # run `nix run nixpkgs#yarn-berry.yarn-berry-fetcher missing-hashes yarn.lock > missing-hashes.json` to update
  missingHashes = ./missing-hashes.json;

  nativeBuildInputs = [
    yarn-berry
    yarn-berry.yarnBerryConfigHook
    # Needed for executing package.json scripts
    nodejs
  ];
})

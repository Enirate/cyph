#!/bin/bash


cd $(cd "$(dirname "$0")" ; pwd)/..
dir="$PWD"


./commands/keycache.sh

mkdir -p ~/lib/js ~/tmplib/js
cd ~/tmplib/js

yarn add --ignore-engines --ignore-platform --ignore-scripts --non-interactive \
	@angular/animations \
	@angular/cli \
	@angular/common \
	@angular/compiler \
	@angular/compiler-cli \
	@angular/core \
	@angular/flex-layout@2.0.0-beta.8 \
	@angular/forms \
	@angular/http \
	@angular/material \
	@angular/platform-browser \
	@angular/platform-browser-dynamic \
	@angular/platform-server \
	@angular/platform-webworker \
	@angular/platform-webworker-dynamic \
	@angular/router \
	@angular/service-worker \
	@compodoc/compodoc \
	@ngrx/core \
	@ngrx/effects \
	@ngrx/router-store \
	@ngrx/store \
	@ngrx/store-devtools \
	@ngtools/webpack \
	@types/braintree-web \
	@types/clipboard-js \
	@types/dompurify \
	@types/file-saver \
	@types/jasmine \
	@types/jquery \
	@types/markdown-it \
	@types/node \
	@types/stacktrace-js \
	angular-smd@https://github.com/buu700/angular-smd-tmp \
	angular-ssr \
	angular2-template-loader \
	animate.css \
	awesome-typescript-loader \
	bourbon@4.2.7 \
	braintree-web \
	braintree-web-drop-in \
	check-tslint-all \
	cheerio \
	clean-css-cli \
	clipboard-js \
	codelyzer \
	copy-webpack-plugin \
	core-js \
	css-loader \
	datauri \
	dompurify \
	extract-text-webpack-plugin \
	fg-loadcss \
	file-loader \
	file-saver \
	firebase \
	firebase-server \
	glob \
	google-closure-compiler \
	granim \
	gulp \
	hammerjs \
	highlight.js \
	html-minifier \
	htmlencode \
	htmllint \
	image-type \
	immutable@rc \
	jasmine-core \
	jasmine-spec-reporter \
	jquery \
	karma \
	karma-chrome-launcher \
	karma-cli \
	karma-coverage-istanbul-reporter \
	karma-jasmine \
	karma-jasmine-html-reporter \
	konami-code.js \
	lazy \
	libsodium-wrappers \
	lunr \
	markdown-it \
	markdown-it-emoji \
	markdown-it-sup \
	mceliece \
	microlight-string \
	mkdirp \
	moment \
	nativescript \
	nativescript-angular \
	nativescript-css-loader \
	nativescript-dev-android-snapshot \
	nativescript-dev-typescript \
	nativescript-dev-webpack \
	nativescript-theme-core \
	node-fetch \
	node-sass \
	ntru \
	od-virtualscroll \
	prepack \
	prepack-webpack-plugin \
	protractor \
	raw-loader \
	read \
	reflect-metadata \
	resolve-url-loader \
	retire \
	rlwe \
	rxjs \
	sass-loader \
	script-ext-html-webpack-plugin \
	sidh \
	simplewebrtc \
	sodiumutil \
	sphincs \
	stacktrace-js \
	style-loader \
	stylelint \
	stylelint-scss \
	supersphincs \
	tab-indent \
	textillate \
	tns-android \
	tns-core-modules \
	tns-core-modules-widgets \
	tns-ios \
	tns-platform-declarations \
	ts-loader \
	ts-node \
	tslint \
	tslint-microsoft-contrib \
	tsutils \
	typedoc \
	typescript \
	uglify-js@^2 \
	unsemantic \
	url-loader \
	web-animations-js@https://github.com/buu700/web-animations-js-tmp \
	webpack \
	webpack-closure-compiler \
	webpack-sources \
	webrtc-adapter \
	whatwg-fetch \
	wowjs \
	xkcd-passphrase \
	zombie \
	zone.js \
	https://github.com/buu700/webrtcsupport \
	https://github.com/morr/jquery.appear \
	$(cat ${dir}/native/plugins.list) \
|| \
	exit 1

cp yarn.lock package.json ~/lib/js/

cat node_modules/tslint/package.json | grep -v tslint-test-config-non-relative > package.json.new
mv package.json.new node_modules/tslint/package.json

for d in firebase-server tslint ; do
	mkdir -p ~/lib/js/module_locks/${d}
	cd node_modules/${d}
	mkdir node_modules 2> /dev/null
	sed -i 's|https://https://|https://|g' yarn.lock 2> /dev/null
	yarn install --ignore-engines --ignore-platform || exit 1
	cp yarn.lock package.json ~/lib/js/module_locks/${d}/
	cd ../..
done

cd ~/lib/js

${dir}/commands/libclone.sh https://github.com/jedisct1/libsodium.js libsodium.build
cd libsodium.build
cat > wrapper/symbols/crypto_stream_chacha20.json << EOM
{
	"name": "crypto_stream_chacha20",
	"type": "function",
	"inputs": [
		{
			"name": "outLength",
			"type": "uint"
		},
		{
			"name": "key",
			"type": "buf",
			"size": "libsodium._crypto_stream_chacha20_keybytes()"
		},
		{
			"name": "nonce",
			"type": "buf",
			"size": "libsodium._crypto_stream_chacha20_noncebytes()"
		}
	],
	"outputs": [
		{
			"name": "out",
			"type": "buf",
			"size": "outLength"
		}
	],
	"target": "libsodium._crypto_stream_chacha20(out_address, outLength, 0, nonce_address, key_address) | 0",
	"expect": "=== 0",
	"return": "_format_output(out, outputFormat)"
}
EOM
cat Makefile |
	perl -pe 's/^(\s+).*--browser-tests.*/\1\@echo/g' |
	perl -pe 's/^(\s+).*BROWSERS_TEST_DIR.*/\1\@echo/g' |
	perl -pe 's/^(\s+)ln /\1ln -f /g' \
> Makefile.new
mv Makefile.new Makefile
make libsodium/configure
# sed -i 's|TOTAL_MEMORY_SUMO=35000000|TOTAL_MEMORY_SUMO=150000000|g' libsodium/dist-build/emscripten.sh
make
find dist -type f -name '*.min.js' -exec bash -c 'mv {} "$(echo "{}" | sed "s|\.min||")"' \;
find dist -type f -not -name '*.js' -exec rm {} \;
cd ..
mkdir libsodium
mv libsodium.build/dist libsodium/
rm -rf libsodium.build


cd "${dir}"
rm -rf shared/lib
mv ~/lib shared/
rm -rf ~/tmplib

./commands/getlibs.sh
./commands/commit.sh updatelibs

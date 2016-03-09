all:
	make javascript

javascript:
	java -jar ../thirdParty/closureCompiler/compiler.jar \
		--compilation_level=ADVANCED_OPTIMIZATIONS \
		--jscomp_error=checkTypes \
		--jscomp_error=accessControls \
		--jscomp_error=checkDebuggerStatement \
		--jscomp_error=internetExplorerChecks \
		--jscomp_error=invalidCasts \
		--jscomp_error=misplacedTypeAnnotation \
		--jscomp_error=missingProperties \
		--jscomp_error=missingProvide \
		--jscomp_error=missingRequire \
		--jscomp_error=missingReturn \
		--jscomp_error=suspiciousCode \
		--jscomp_error=undefinedNames \
		--jscomp_error=visibility \
		--jscomp_warning=extraRequire \
		--warning_level=VERBOSE \
		--js ../thirdParty/closureLibrary/closure/goog/base.js js/ \
		--js_output_file landscape.js

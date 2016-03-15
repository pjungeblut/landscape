all:
	make javascript

javascript:
	java -jar ../thirdParty/closureCompiler/compiler.jar \
		--compilation_level=ADVANCED_OPTIMIZATIONS \
		--jscomp_error=accessControls \
		--jscomp_error=ambiguousFunctionDecl \
		--jscomp_error=checkTypes \
		--jscomp_error=checkVars \
		--jscomp_error=conformanceViolations \
		--jscomp_error=const \
		--jscomp_error=constantProperty \
		--jscomp_error=deprecated \
		--jscomp_error=internetExplorerChecks \
		--jscomp_error=invalidCasts \
		--jscomp_error=missingProperties \
		--jscomp_error=missingProvide \
		--jscomp_error=missingRequire \
		--jscomp_error=missingReturn \
		--jscomp_error=nonStandardJsDocs \
		--jscomp_error=suspiciousCode \
		--jscomp_error=typeInvalidation \
		--jscomp_error=undefinedNames \
		--jscomp_error=undefinedVars \
		--jscomp_error=unnecessaryCasts \
		--jscomp_error=uselessCode \
		--jscomp_error=visibility \
		--jscomp_warning=extraRequire \
		--warning_level=VERBOSE \
		--js ../thirdParty/closureLibrary/closure/goog/base.js js/ \
		--js_output_file landscape.js

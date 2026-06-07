allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// Por defecto compila en <proyecto>/build (funciona en la nube: Codemagic/Linux).
// En Windows con el repo dentro de OneDrive, define la variable de entorno CS_BUILD_DIR
// (p. ej. C:/csb/child) para compilar en una ruta CORTA y fuera de OneDrive, evitando
// bloqueos de sincronización y el límite de 260 caracteres de Windows.
val csBuildDir: String? = System.getenv("CS_BUILD_DIR")
val newBuildDir: Directory =
    if (csBuildDir != null) rootProject.layout.projectDirectory.dir(csBuildDir)
    else rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

import com.android.build.gradle.AppExtension

val android = project.extensions.getByType(AppExtension::class.java)

android.apply {
    flavorDimensions("flavor-type")

    productFlavors {
        create("dev") {
            dimension = "flavor-type"
            applicationId = "com.example.app.dev"
            resValue(type = "string", name = "app_name", value = "App Dev")
        }
        create("prod") {
            dimension = "flavor-type"
            applicationId = "com.example.app"
            resValue(type = "string", name = "app_name", value = "App")
        }
    }

    buildFeatures.resValues = true
}
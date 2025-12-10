package com.yoga.dict.ui.screens

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.yoga.dict.data.model.AsanaName
import com.yoga.dict.data.model.Source
import com.yoga.dict.ui.viewmodel.AsanaManagementViewModel
import com.yoga.dict.ui.viewmodel.SourcesViewModel
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddAsanaScreen(
    onBack: () -> Unit,
    onSuccess: () -> Unit,
    asanaViewModel: AsanaManagementViewModel = hiltViewModel(),
    sourcesViewModel: SourcesViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    
    // Состояние формы
    var selectedNameId by remember { mutableStateOf<String?>(null) }
    var newNameRu by remember { mutableStateOf("") }
    var newNameSanskrit by remember { mutableStateOf("") }
    var newNameTransliteration by remember { mutableStateOf("") }
    var newNameDefinition by remember { mutableStateOf("") }
    var selectedSourceId by remember { mutableStateOf<String?>(null) }
    var newSourceTitle by remember { mutableStateOf("") }
    var newSourceAuthor by remember { mutableStateOf("") }
    var newSourceYear by remember { mutableStateOf("") }
    var newSourcePublisher by remember { mutableStateOf("") }
    var newSourcePages by remember { mutableStateOf("") }
    var newSourceAnnotation by remember { mutableStateOf("") }
    var selectedPhotos by remember { mutableStateOf<List<Uri>>(emptyList()) }
    
    var showNameDialog by remember { mutableStateOf(false) }
    var showSourceDialog by remember { mutableStateOf(false) }
    var nameSearchQuery by remember { mutableStateOf("") }
    var sourceSearchQuery by remember { mutableStateOf("") }
    
    val asanaNames by asanaViewModel.asanaNames.collectAsStateWithLifecycle()
    val sources by sourcesViewModel.sources.collectAsStateWithLifecycle()
    val isLoading by asanaViewModel.isLoading.collectAsStateWithLifecycle()
    val error by asanaViewModel.error.collectAsStateWithLifecycle()
    
    LaunchedEffect(Unit) {
        sourcesViewModel.loadSources()
    }
    
    // Отслеживаем успешное добавление
    var wasAdding by remember { mutableStateOf(false) }
    LaunchedEffect(error, isLoading) {
        if (wasAdding && error == null && !isLoading) {
            Toast.makeText(context, "Асана успешно добавлена", Toast.LENGTH_SHORT).show()
            onSuccess()
            wasAdding = false
        } else if (wasAdding && error != null) {
            Toast.makeText(context, "Ошибка: $error", Toast.LENGTH_LONG).show()
            wasAdding = false
        }
    }
    
    val imagePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        selectedPhotos = selectedPhotos + uris
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Добавить асану") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    } else {
                        IconButton(
                            onClick = {
                                // Валидация и отправка
                                if ((selectedNameId != null || newNameRu.isNotBlank()) && 
                                    (selectedSourceId != null || (newSourceTitle.isNotBlank() && newSourceAuthor.isNotBlank()))) {
                                    
                                    val photos = selectedPhotos.map { uri ->
                                        File(context.cacheDir, uri.lastPathSegment ?: "photo.jpg").apply {
                                            context.contentResolver.openInputStream(uri)?.use { input ->
                                                outputStream().use { output ->
                                                    input.copyTo(output)
                                                }
                                            }
                                        }
                                    }
                                    
                                    wasAdding = true
                                    asanaViewModel.addAsana(
                                        selectedNameId,
                                        if (selectedNameId == null) newNameRu else null,
                                        if (selectedNameId == null) newNameSanskrit.takeIf { it.isNotBlank() } else null,
                                        if (selectedNameId == null) newNameTransliteration.takeIf { it.isNotBlank() } else null,
                                        if (selectedNameId == null) newNameDefinition.takeIf { it.isNotBlank() } else null,
                                        selectedSourceId,
                                        if (selectedSourceId == null) newSourceTitle.takeIf { it.isNotBlank() } else null,
                                        if (selectedSourceId == null) newSourceAuthor.takeIf { it.isNotBlank() } else null,
                                        if (selectedSourceId == null) newSourceYear.takeIf { it.isNotBlank() } else null,
                                        if (selectedSourceId == null) newSourcePublisher.takeIf { it.isNotBlank() } else null,
                                        if (selectedSourceId == null) newSourcePages.takeIf { it.isNotBlank() } else null,
                                        if (selectedSourceId == null) newSourceAnnotation.takeIf { it.isNotBlank() } else null,
                                        photos
                                    )
                                } else {
                                    Toast.makeText(context, "Заполните обязательные поля", Toast.LENGTH_SHORT).show()
                                }
                            }
                        ) {
                            Icon(Icons.Default.Check, contentDescription = "Сохранить")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Выбор или создание названия
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Название асаны *",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    
                    if (selectedNameId != null) {
                        val selectedName = asanaNames.find { (it.id ?: it.name_ru) == selectedNameId }
                        OutlinedTextField(
                            value = selectedName?.name_ru ?: "",
                            onValueChange = { },
                            readOnly = true,
                            label = { Text("Выбранное название") },
                            trailingIcon = {
                                IconButton(onClick = { selectedNameId = null }) {
                                    Icon(Icons.Default.Close, contentDescription = "Очистить")
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = { showNameDialog = true },
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Выбрать существующее")
                            }
                            TextButton(onClick = { /* Показать форму создания */ }) {
                                Text("Создать новое")
                            }
                        }
                        
                        OutlinedTextField(
                            value = newNameRu,
                            onValueChange = { newNameRu = it },
                            label = { Text("Название на русском *") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        
                        OutlinedTextField(
                            value = newNameSanskrit,
                            onValueChange = { newNameSanskrit = it },
                            label = { Text("Название на санскрите") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        
                        OutlinedTextField(
                            value = newNameTransliteration,
                            onValueChange = { newNameTransliteration = it },
                            label = { Text("Транслитерация") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        
                        OutlinedTextField(
                            value = newNameDefinition,
                            onValueChange = { newNameDefinition = it },
                            label = { Text("Определение") },
                            modifier = Modifier.fillMaxWidth(),
                            maxLines = 3
                        )
                    }
                }
            }
            
            // Выбор или создание источника
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Источник *",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    
                    if (selectedSourceId != null) {
                        val selectedSource = sources.find { it.id == selectedSourceId }
                        OutlinedTextField(
                            value = selectedSource?.displayName ?: "",
                            onValueChange = { },
                            readOnly = true,
                            label = { Text("Выбранный источник") },
                            trailingIcon = {
                                IconButton(onClick = { selectedSourceId = null }) {
                                    Icon(Icons.Default.Close, contentDescription = "Очистить")
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = { showSourceDialog = true },
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Выбрать существующий")
                            }
                            TextButton(onClick = { /* Показать форму создания */ }) {
                                Text("Создать новый")
                            }
                        }
                        
                        OutlinedTextField(
                            value = newSourceTitle,
                            onValueChange = { newSourceTitle = it },
                            label = { Text("Название источника *") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        
                        OutlinedTextField(
                            value = newSourceAuthor,
                            onValueChange = { newSourceAuthor = it },
                            label = { Text("Автор *") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = newSourceYear,
                                onValueChange = { newSourceYear = it },
                                label = { Text("Год") },
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = newSourcePages,
                                onValueChange = { newSourcePages = it },
                                label = { Text("Страницы") },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        
                        OutlinedTextField(
                            value = newSourcePublisher,
                            onValueChange = { newSourcePublisher = it },
                            label = { Text("Издательство") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        
                        OutlinedTextField(
                            value = newSourceAnnotation,
                            onValueChange = { newSourceAnnotation = it },
                            label = { Text("Аннотация") },
                            modifier = Modifier.fillMaxWidth(),
                            maxLines = 3
                        )
                    }
                }
            }
            
            // Загрузка фотографий
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Фотографии",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    
                    OutlinedButton(
                        onClick = { imagePicker.launch("image/*") },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.AddPhotoAlternate, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Добавить фотографии")
                    }
                    
                    if (selectedPhotos.isNotEmpty()) {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(selectedPhotos) { uri ->
                                Box(
                                    modifier = Modifier
                                        .size(100.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                ) {
                                    AsyncImage(
                                        model = ImageRequest.Builder(context)
                                            .data(uri)
                                            .crossfade(true)
                                            .build(),
                                        contentDescription = null,
                                        modifier = Modifier.fillMaxSize(),
                                        contentScale = ContentScale.Crop
                                    )
                                    IconButton(
                                        onClick = { selectedPhotos = selectedPhotos - uri },
                                        modifier = Modifier.align(Alignment.TopEnd)
                                    ) {
                                        Icon(
                                            Icons.Default.Close,
                                            contentDescription = "Удалить",
                                            tint = MaterialTheme.colorScheme.error
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            error?.let {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Text(
                        text = it,
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }
    }
    
    // Диалог выбора названия
    if (showNameDialog) {
        AlertDialog(
            onDismissRequest = { showNameDialog = false },
            title = { Text("Выберите название") },
            text = {
                Column {
                    OutlinedTextField(
                        value = nameSearchQuery,
                        onValueChange = { nameSearchQuery = it },
                        label = { Text("Поиск") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    val filtered = asanaNames.filter {
                        it.name_ru.contains(nameSearchQuery, ignoreCase = true) ||
                        it.name_sanskrit?.contains(nameSearchQuery, ignoreCase = true) == true
                    }
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 400.dp)
                    ) {
                        items(filtered) { name ->
                            ListItem(
                                headlineContent = { Text(name.name_ru) },
                                supportingContent = { 
                                    name.name_sanskrit?.let { Text(it) }
                                },
                                modifier = Modifier.clickable {
                                    selectedNameId = name.id ?: name.name_ru
                                    showNameDialog = false
                                }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showNameDialog = false }) {
                    Text("Отмена")
                }
            }
        )
    }
    
    // Диалог выбора источника
    if (showSourceDialog) {
        AlertDialog(
            onDismissRequest = { showSourceDialog = false },
            title = { Text("Выберите источник") },
            text = {
                Column {
                    OutlinedTextField(
                        value = sourceSearchQuery,
                        onValueChange = { sourceSearchQuery = it },
                        label = { Text("Поиск") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    val filtered = sources.filter {
                        it.title.contains(sourceSearchQuery, ignoreCase = true) ||
                        it.author.contains(sourceSearchQuery, ignoreCase = true)
                    }
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 400.dp)
                    ) {
                        items(filtered) { source ->
                            ListItem(
                                headlineContent = { Text(source.title) },
                                supportingContent = { Text("${source.author}${source.year?.let { " ($it)" } ?: ""}") },
                                modifier = Modifier.clickable {
                                    selectedSourceId = source.id
                                    showSourceDialog = false
                                }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showSourceDialog = false }) {
                    Text("Отмена")
                }
            }
        )
    }
}
